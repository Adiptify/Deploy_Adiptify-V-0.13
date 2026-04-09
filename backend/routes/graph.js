import express from "express";
import { auth } from "../middleware/auth.js";
import { logAI } from "../middleware/aiLogger.js";
import Subject from "../models/Subject.js";
import { Ollama } from 'ollama';

const router = express.Router();

router.get("/subject/:subjectId", auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    // 1. Return cached graph if available
    if (subject.cachedGraph && Object.keys(subject.cachedGraph).length > 0) {
      return res.json(subject.cachedGraph);
    }

    // 2. Generate if cache is missing
    const topic = subject.name;
    const initialPrompt = `
        You are an expert systems architect. Generate a DEEP structured knowledge map for the topic: "${topic}".
        
        OUTPUT ONLY VALID JSON. 
        Format:
        {
          "root": {
            "id": "root",
            "label": "${topic}",
            "desc": "Detailed overview of ${topic}, explaining its core significance and main applications."
          },
          "children": [
            {
              "id": "l1_1",
              "label": "Level 1 Category",
              "desc": "Provide a detailed 2-3 sentence explanation of this category, its role within the system, and why it is essential.",
              "children": [
                {
                  "id": "l2_1",
                  "label": "Level 2 Sub-category",
                  "desc": "A specific 2-3 sentence deep-dive into this sub-category, detailing its functions or characteristics."
                }
              ]
            }
          ]
        }
        
        Requirements:
        1. Generate 4-5 Level 1 categories.
        2. For EACH Level 1 category, generate 2-3 Level 2 sub-categories.
        3. Ensure all descriptions are DETAILED (at least 2-3 substantial sentences per node).
        `;

    const { config } = await import("../config/index.js");

    const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
      ? config.ollamaBaseUrl
      : 'http://127.0.0.1:11434';

    const ollama = new Ollama({ host: ollamaBase });

    const response = await ollama.chat({
      model: config.ollamaModel || 'deepseek-v3.1:671b-cloud',
      messages: [
        { role: 'system', content: initialPrompt },
        { role: 'user', content: `Generate a complete 2-level deep graph for ${topic}` }
      ],
      stream: false,
      format: 'json'
    });

    let resultJson;
    try {
      resultJson = JSON.parse(response.message.content.trim());
    } catch (e) {
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultJson = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON");
      }
    }

    // 3. Cache the generated graph
    subject.cachedGraph = resultJson;
    await subject.save();

    await logAI({
      userId: req.user._id, userName: req.user.name, role: req.user.role,
      endpoint: "/api/graph/subject/:subjectId", params: { topic },
      status: "success", model: "ollama",
      request: `Graph Cache Gen: ${topic}`, response: "Cached Graph Generated",
    });

    return res.json(resultJson);

  } catch (e) {
    console.warn("Graph Gen Error for cache:", e.message);
    return res.json({
      root: {
        id: "root",
        label: "Mock " + req.params.subjectId,
        desc: "Mock generated due to AI offline. Start Ollama server for real graphs."
      },
      children: []
    });
  }
});

router.post("/generate", auth, async (req, res) => {
  try {
    const { topic, pathContext = "" } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const isInitial = !pathContext;

    const initialPrompt = `
        You are an expert systems architect. Generate a DEEP structured knowledge map for the topic: "${topic}".
        
        OUTPUT ONLY VALID JSON. 
        Format:
        {
          "root": {
            "id": "root",
            "label": "${topic}",
            "desc": "Detailed overview of ${topic}, explaining its core significance and main applications."
          },
          "children": [
            {
              "id": "l1_1",
              "label": "Level 1 Category",
              "desc": "Provide a detailed 2-3 sentence explanation of this category, its role within the system, and why it is essential.",
              "children": [
                {
                  "id": "l2_1",
                  "label": "Level 2 Sub-category",
                  "desc": "A specific 2-3 sentence deep-dive into this sub-category, detailing its functions or characteristics."
                }
              ]
            }
          ]
        }
        
        Requirements:
        1. Generate 4-5 Level 1 categories.
        2. For EACH Level 1 category, generate 2-3 Level 2 sub-categories.
        3. Ensure all descriptions are DETAILED (at least 2-3 substantial sentences per node).
        `;

    const expansionPrompt = `
        You are an expert systems architect. Expand the knowledge map for the node: "${topic}".
        User is exploring "${pathContext}".
        
        OUTPUT ONLY VALID JSON. 
        Format:
        {
          "nodes": [
            {
              "id": "new_l1_1",
              "label": "Title",
              "desc": "Detailed 2-3 sentence description.",
              "children": [
                {
                  "id": "new_l2_1",
                  "label": "Deep Sub-detail",
                  "desc": "Specific 2-3 sentence description."
                }
              ]
            }
          ]
        }
        Generate 3-5 detailed sub-categories for "${topic}".
        For EACH sub-category, generate 1-2 deeper sub-details (2 levels deep in total).
        Each description MUST be at least 2-3 sentences long.
        `;

    const systemPrompt = isInitial ? initialPrompt : expansionPrompt;

    const { config } = await import("../config/index.js");

    const ollamaBase = (typeof config.ollamaBaseUrl === 'string' && config.ollamaBaseUrl.trim() !== '')
      ? config.ollamaBaseUrl
      : 'http://127.0.0.1:11434';

    const ollama = new Ollama({ host: ollamaBase });

    const response = await ollama.chat({
      model: config.ollamaModel || 'deepseek-v3.1:671b-cloud',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isInitial ? `Generate a complete 2-level deep graph for ${topic}` : `Expand on ${topic}` }
      ],
      stream: false,
      format: 'json'
    });

    if (!response.message || !response.message.content) {
      throw new Error("Invalid response format from Ollama API");
    }

    const content = response.message.content.trim();
    let resultJson;
    try {
      resultJson = JSON.parse(content);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Content:", content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultJson = JSON.parse(jsonMatch[0]);
      } else {
        throw parseError;
      }
    }

    await logAI({
      userId: req.user._id, userName: req.user.name, role: req.user.role,
      endpoint: "/api/graph/generate", params: { topic, isInitial },
      status: "success", model: "ollama",
      request: `Graph Gen: ${topic}`, response: "Graph JSON Response",
    });

    return res.json(resultJson);
  } catch (e) {
    console.warn("Graph Gen Error (Ollama offline?), providing mock response:", e.message);

    if (isInitial) {
      return res.json({
        root: {
          id: "root",
          label: topic || "Mock Topic",
          desc: "This is a mock overview of the topic since the AI is currently offline. Start the Ollama server for real generated graphs."
        },
        children: [
          {
            id: "l1_1",
            label: "Mock Subtopic 1",
            desc: "This is a mock subtopic generated by the fallback system.",
            children: [
              {
                id: "l2_1",
                label: "Mock Detail A",
                desc: "A specific detail about this mock subtopic."
              }
            ]
          },
          {
            id: "l1_2",
            label: "Mock Subtopic 2",
            desc: "Another mock section for layout testing.",
            children: []
          }
        ]
      });
    } else {
      return res.json({
        nodes: [
          {
            id: `exp_1_${Date.now()}`,
            label: `Expanded: ${topic}`,
            desc: "This is a mocked deep expansion node. The AI server is offline.",
            children: []
          }
        ]
      });
    }
  }
});

export default router;
