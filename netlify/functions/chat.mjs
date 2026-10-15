
export default async (req) => {
  if (req.method !== "POST") {
    return Response.json(
      { error: "გამოიყენე POST მოთხოვნა." },
      { status: 405 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "GEMINI_API_KEY ვერ მოიძებნა Netlify-ში." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "მოთხოვნის ფორმატი არასწორია." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.messages) || !body.messages.length) {
    return Response.json(
      { error: "ჯერ დაწერე კითხვა." },
      { status: 400 }
    );
  }

  const messages = body.messages
    .slice(-12)
    .filter(m =>
      m &&
      ["user", "assistant"].includes(m.role) &&
      typeof m.content === "string"
    )
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.slice(0, 1500) }]
    }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "ბოლო შეტყობინება მომხმარებლის კითხვა უნდა იყოს." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "შენ ხარ PlantAI, მცენარეების მოვლის დამხმარე. ყოველთვის უპასუხე ქართულად, მეგობრულად და პრაქტიკულად. დაეხმარე მორწყვაში, განათებაში, ნიადაგში, სასუქსა და გავრცელებული პრობლემების გაგებაში. თუ ინფორმაცია არასაკმარისია, დასვი დამაზუსტებელი კითხვა. სავარაუდო დაავადება ზუსტ დიაგნოზად არ წარმოაჩინო."
            }]
          },
          contents: messages,
          generationConfig: {
            maxOutputTokens: 500
          }
        })
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("Gemini API error:", upstream.status, data?.error?.message);
      return Response.json(
        { error: "Gemini-მ ვერ გვიპასუხა. გადაამოწმე API გასაღები და API-ის ლიმიტები." },
        { status: 502 }
      );
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return Response.json(
        { error: "AI-მ ცარიელი პასუხი დააბრუნა. სცადე თავიდან." },
        { status: 502 }
      );
    }

    return Response.json({ answer });
  } catch (error) {
    console.error("PlantAI error:", error?.message || "unknown");
    return Response.json(
      { error: "სერვერთან დაკავშირება ვერ მოხერხდა." },
      { status: 500 }
    );
  }
};
