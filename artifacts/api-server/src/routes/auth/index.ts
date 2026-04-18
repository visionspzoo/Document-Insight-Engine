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

router.post("/auth/login", async (req, res) => {
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

  try {
    const lookup = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(emailAddress)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const users = (await lookup.json()) as Array<{ id: string }>;
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({ error: "Nieprawidłowy email lub hasło." });
    }
    const userId = users[0].id;

    const verify = await fetch(
      `https://api.clerk.com/v1/users/${userId}/verify_password`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      },
    );
    const verifyData = (await verify.json()) as { verified?: boolean };
    if (!verify.ok || !verifyData.verified) {
      return res.status(401).json({ error: "Nieprawidłowy email lub hasło." });
    }

    const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
    });
    const tokenData = (await tokenRes.json()) as { token?: string };
    if (!tokenRes.ok || !tokenData.token) {
      return res.status(500).json({ error: "Nie udało się utworzyć sesji." });
    }

    return res.status(200).json({ ticket: tokenData.token });
  } catch {
    return res.status(500).json({ error: "Błąd serwera podczas logowania." });
  }
});

export default router;
