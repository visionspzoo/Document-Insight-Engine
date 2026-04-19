import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { FileText, Eye, EyeOff, Loader as Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CustomSignUpPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Konto zostało utworzone. Zaloguj się teraz.");
        setLocation(`${basePath}/sign-in`);
        return;
      }

      setLocation("/dashboard");
    } catch {
      setError("Rejestracja nie powiodła się. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "hsl(220, 25%, 10%)",
            border: "1px solid hsl(220, 20%, 16%)",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
          }}
        >
          <div className="px-8 pt-8 pb-6 flex flex-col gap-5">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-2 text-primary font-bold text-3xl tracking-tight">
                <FileText className="h-9 w-9" />
                <span>
                  Doc<span style={{ color: "hsl(210,20%,98%)" }}>Sage</span>
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Utwórz konto</h1>
                <p className="text-sm mt-1" style={{ color: "hsl(215,20%,65%)" }}>
                  Dołącz do DocSage już dziś
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium"
                  style={{ color: "hsl(215,20%,65%)" }}
                >
                  Adres e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Wprowadź adres email"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "hsl(220,30%,8%)",
                    border: "1px solid hsl(220,20%,16%)",
                    color: "hsl(210,20%,98%)",
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium"
                  style={{ color: "hsl(215,20%,65%)" }}
                >
                  Hasło
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Utwórz hasło (min. 8 znaków)"
                    className="w-full rounded-lg px-3 py-2 pr-10 text-sm outline-none"
                    style={{
                      background: "hsl(220,30%,8%)",
                      border: "1px solid hsl(220,20%,16%)",
                      color: "hsl(210,20%,98%)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "hsl(0,60%,15%)",
                    border: "1px solid hsl(0,60%,30%)",
                    color: "hsl(0,80%,70%)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "hsl(210,100%,55%)" }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Zarejestruj się
              </button>
            </form>
          </div>

          <div
            className="px-8 py-4 text-center text-sm"
            style={{
              background: "hsl(220,25%,8%)",
              borderTop: "1px solid hsl(220,20%,16%)",
              color: "hsl(215,20%,65%)",
            }}
          >
            Masz już konto?{" "}
            <Link
              href={`${basePath}/sign-in`}
              className="font-medium hover:underline"
              style={{ color: "hsl(210,100%,55%)" }}
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
