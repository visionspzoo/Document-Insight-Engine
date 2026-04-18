import { Router } from "express";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const { emailAddress, password } = req.body as {
    emailAddress?: string;
    password?: string;
  };

  if (!emailAddress || !password) {
    return res.status(400).json({ error: "Brak adresu email lub hasła." });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: "Brak klucza Clerk." });
  }

  const response = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [emailAddress],
      password,
      skip_password_checks: false,
    }),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok) {
    const errors = (data.errors as Array<{ message?: string; long_message?: string }>) ?? [];
    const firstMsg = errors[0]?.long_message ?? errors[0]?.message ?? "Rejestracja nie powiodła się.";
    return res.status(response.status).json({ error: firstMsg });
  }

  return res.status(201).json({ id: (data as { id: string }).id });
});

export default router;
