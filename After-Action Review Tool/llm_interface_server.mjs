import express from "express";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express(); // initialize Express application

app.use(cors());
app.use(bodyParser.json());

const chatModel = new ChatOpenAI({});

app.post('/chat', async (req, res) => {
  const { messages } = req.body; // Expecting an array of messages

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).send({ error: "Messages array is required" });
  }

  try {
    // format messages from the message history
    let formattedMessages = [];
    for (let i = 0; i<messages.length; i++) {
      if (messages[i]["role"] == "user") {
        formattedMessages.push(new HumanMessage(messages[i]["content"]));
      }
      else if (messages[i]["role"] == "bot") {
        formattedMessages.push(new AIMessage(messages[i]["content"]));
      }
      else if (messages[i]["role"] == "system") {
        formattedMessages.push(new SystemMessage(messages[i]["content"]));
      }
      else {
        console.log("invalid message: " + messages[i]);
      }
    }    
    const response = await chatModel.invoke(formattedMessages);
    res.send({ response: response.content });
  } catch (error) {
    console.error("Error during LangChain request:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// endpoint to export chat history
app.post('/export-chat', (req, res) => {
  const { messages } = req.body; // Expecting an array of messages

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).send({ error: "Messages array is required" });
  }

  try {
    // Convert chat history to JSON string (or other formats if needed)
    const jsonString = JSON.stringify(messages, null, 2);

    // Set response headers to prompt download
    res.setHeader('Content-Disposition', 'attachment; filename=chat-history.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (error) {
    console.error("Error exporting chat history:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});


app.listen(3000, () => {
  console.log(`Server is running on port 3000`);
});
