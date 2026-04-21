"""
Task Chat Runner — reads conversation JSON from stdin, returns a single JSON line to stdout.

Input (stdin):
  {"messages": [{"role": "user"|"assistant", "content": "..."}]}

Output (stdout) — one of:
  {"done": false, "question": "..."}
  {"done": true, "description": "..."}
"""

import asyncio
import json
import sys


SYSTEM_PROMPT = """You are a task clarification assistant embedded in a task management app.
Your job is to ask targeted follow-up questions to help a developer write a detailed task description.

Rules:
1. Ask at most 3 questions in total (counting the opening question). After that you MUST generate the description.
2. After each user response, decide if you already have enough information to write a good description.
   If yes, return {"done": true, "description": "..."} immediately without asking another question.
3. Ask ONE question at a time. Keep questions short and specific.
4. When you have enough information, generate a description in this exact format:

**Wat:** [short description of what needs to change]

**Nu:** [current behavior]

**Verwacht:** [desired behavior]

**Acceptatiecriteria:**
- [criterion 1]
- [criterion 2]

5. Always respond in valid JSON only — no markdown, no preamble, just the JSON object.
6. The language of questions and description should match the user's language.

Response format — one of:
{"done": false, "question": "your question here"}
{"done": true, "description": "the full formatted description here"}
"""


async def run_chat(messages: list) -> None:
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

    # Build the prompt from conversation history
    conversation_text = ""
    for msg in messages:
        role = "User" if msg["role"] == "user" else "Assistant"
        conversation_text += f"{role}: {msg['content']}\n\n"

    prompt = (
        conversation_text.strip()
        + "\n\nAssistant (respond in JSON only):"
    )

    client = ClaudeSDKClient(
        options=ClaudeAgentOptions(
            model="claude-haiku-4-5",
            system_prompt=SYSTEM_PROMPT,
            max_turns=1,
        )
    )

    async with client:
        await client.query(prompt)

        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__
            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text

    if not response_text.strip():
        print(json.dumps({"done": False, "question": "Can you describe what you want to change?"}))
        return

    # Strip markdown code fences if the model wrapped the JSON
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(cleaned.split("\n")[1:])
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        parsed = json.loads(cleaned)
        print(json.dumps(parsed))
    except json.JSONDecodeError:
        # Model didn't return JSON — treat as a question
        print(json.dumps({"done": False, "question": cleaned[:300]}))


def main() -> None:
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        messages = payload.get("messages", [])
        asyncio.run(run_chat(messages))
    except Exception as e:
        print(json.dumps({"done": False, "question": f"Error: {e}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
