// chatgpt_terminal.mjs
import fetch from 'node-fetch';
import readline from 'readline';

const API_KEY = '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';  // Replace with your API key
const API_URL = 'https://api.openai.com/v1/chat/completions';

// Set up readline for user input in the terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: '
});

async function sendMessage(message) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',  // Use the model you prefer
                messages: [{ role: 'user', content: message }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        console.log(`ChatGPT: ${reply}`);
        rl.prompt();
    } catch (error) {
        console.error('Error:', error);
    }
}

console.log("Talk to ChatGPT! Type your message and hit enter.");
rl.prompt();

rl.on('line', (line) => {
    sendMessage(line.trim());
}).on('close', () => {
    console.log("Goodbye!");
    process.exit(0);
});
