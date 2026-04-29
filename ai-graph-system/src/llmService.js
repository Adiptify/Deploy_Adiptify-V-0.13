export const getAIResponse = async (topic, pathContext = "") => {
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

  let systemPrompt = isInitial ? initialPrompt : expansionPrompt;
  let userPrompt = isInitial ? `Generate a complete 2-level deep graph for ${topic}` : `Expand on ${topic}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-oss:120b-cloud',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          format: 'json'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.message || !data.message.content) {
        throw new Error("Invalid response format from Ollama API");
      }

      let content = data.message.content.trim();
      let parsed = null;
      
      try {
        parsed = JSON.parse(content);
      } catch (e) {}

      if (!parsed && content.startsWith("```")) {
        let noMd = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        try { parsed = JSON.parse(noMd); } catch (e) {}
      }

      if (!parsed) {
        const mdMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (mdMatch && mdMatch[1]) {
          try { parsed = JSON.parse(mdMatch[1].trim()); } catch (e) {}
        }
      }

      if (!parsed) {
        const objMatch = content.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try { parsed = JSON.parse(objMatch[0]); } catch (e) {}
        }
      }

      if (parsed) {
        return parsed;
      }
      
      throw new Error("Could not extract valid JSON from response.");
    } catch (error) {
      console.warn(`[LLM Service] Attempt ${attempt} failed:`, error.message);
      userPrompt += `\n\nCRITICAL FEEDBACK ON PREVIOUS ATTEMPT:\nYour previous response failed to parse as valid JSON. Error: ${error.message}. Please strictly output ONLY valid JSON without any markdown formatting or preamble.`;
    }
  }

  console.error("LLM Service Error: Failed after 3 attempts");
  return isInitial ? { root: { id: 'root', label: topic, desc: 'Error generating graph' }, children: [] } : { nodes: [] };
};
