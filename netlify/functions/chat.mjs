export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "გამოიყენე POST მოთხოვნა." }, { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI გასაღები ჯერ არ არის დაყენებული. საიტის მფლობელმა Netlify-ში უნდა დაამატოს OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "მოთხოვნის ფორმატი არასწორია." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "ჯერ დაწერე კითხვა." }, { status: 400 });
  }

  const messages = body.messages.slice(-12).filter((m) =>
    m && ["user", "assistant"].includes(m.role) && typeof m.content === "string"
  ).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "ბოლო შეტყობინება მომხმარებლის კითხვა უნდა იყოს." }, { status: 400 });
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        instructions: "შენ ხარ PlantAI — მცენარეების მოვლის დამხმარე. ყოველთვის უპასუხე ქართულად, მარტივად, მეგობრულად და პრაქტიკულად. დაეხმარე ოთახის და ბაღის მცენარეების მორწყვაში, სინათლეში, ნიადაგში, სასუქში და გავრცელებული პრობლემების გაგებაში. თუ ინფორმაცია არასაკმარისია, დასვი დამაზუსტებელი კითხვა. ნუ წარმოაჩენ სავარაუდო დაავადებას როგორც ზუსტ დიაგნოზს; აუხსენი, რომ რამდენიმე მიზეზი შეიძლება არსებობდეს. არ მოიგონო მცენარის სახეობა ან ფაქტები. პასუხი იყოს მოკლე და სასარგებლო.",
        input: messages,
        max_output_tokens: 500
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error("OpenAI API error:", upstream.status, data?.error?.code || "unknown");
      if (upstream.status === 401) {
        return Response.json({ error: "API გასაღები არასწორია. გადაამოწმე Netlify-ში შენახული გასაღები." }, { status: 502 });
      }
      if (upstream.status === 429) {
        return Response.json({ error: "AI-ის ლიმიტი ან ბალანსი ამჟამად ამოწურულია. გადაამოწმე API ანგარიშის ბილინგი და ლიმიტები." }, { status: 502 });
      }
      return Response.json({ error: "AI-მ დროებით ვერ გვიპასუხა. ცოტა ხანში სცადე თავიდან." }, { status: 502 });
    }

    const answer = typeof data.output_text === "string" ? data.output_text.trim() : "";
    if (!answer) {
      return Response.json({ error: "AI-მ ცარიელი პასუხი დააბრუნა. სცადე თავიდან." }, { status: 502 });
    }
    return Response.json({ answer });
  } catch (error) {
    console.error("PlantAI chat function error:", error?.message || "unknown");
    return Response.json({ error: "სერვერთან დაკავშირება ვერ მოხერხდა. სცადე მოგვიანებით." }, { status: 500 });
  }
};
