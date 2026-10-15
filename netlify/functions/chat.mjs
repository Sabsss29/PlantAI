
export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST requests are allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is missing in Netlify" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await request.json();
    const messages = Array.isArray(body.messages)
      ? body.messages
      : [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const contents = messages
      .filter(
        (message) =>
          ["user", "assistant", "model"].includes(message.role) &&
          typeof message.content === "string" &&
          message.content.trim() !== ""
      )
      .map((message) => ({
        role:
          message.role === "assistant" || message.role === "model"
            ? "model"
            : "user",
        parts: [{ text: message.content }],
      }));

    if (contents.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid messages provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "შენ ხარ PlantAI — მცენარეების მოვლის დამხმარე. " +
                  "უპასუხე ქართულად, მეგობრულად და გასაგებად. " +
                  "დაეხმარე მომხმარებელს მცენარის ამოცნობაში, მორწყვაში, " +
                  "განათებაში, ნიადაგში, სასუქსა და დაავადებების ამოცნობაში. " +
                  "თუ ინფორმაცია არასაკმარისია, დასვი დამაზუსტებელი კითხვა. " +
                  "არ წარმოადგინო ვარაუდი დადასტურებულ ფაქტად.",
              },
            ],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 500,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        JSON.stringify(data)
      );

      return new Response(
        JSON.stringify({
          error:
            data?.error?.message ||
            "Gemini API request failed",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      console.error("Gemini returned no text:", JSON.stringify(data));

      return new Response(
        JSON.stringify({ error: "Gemini returned an empty response" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("PlantAI function error:", error);

    return new Response(
      JSON.stringify({
        error: "Server error. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
