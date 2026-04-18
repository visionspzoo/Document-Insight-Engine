import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, Brain, Download, Shield, ChevronRight, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
          <FileText className="h-6 w-6" />
          <span>Doc<span className="text-foreground">Sage</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Zaloguj się</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm" className="gap-1">
              Zarejestruj się <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 gap-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
          <Zap className="h-3.5 w-3.5" />
          Zasilany przez Claude AI
        </div>

        <div className="space-y-4 max-w-3xl">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
            Inteligentna analiza<br />
            <span className="text-primary">dokumentów</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-xl mx-auto">
            Wydobywaj dane z umów, faktur i dokumentów prawnych hurtowo — używając sztucznej inteligencji. Eksportuj wyniki w sekundy.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 text-base px-8">
              Zacznij za darmo <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="text-base px-8">
              Zaloguj się
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 max-w-3xl w-full">
          {[
            {
              icon: Brain,
              title: "AI Ekstrakcja",
              desc: "Claude AI wydobywa strukturalne dane z dowolnego dokumentu z wysoką precyzją.",
            },
            {
              icon: FileText,
              title: "Masowe przetwarzanie",
              desc: "Wgraj setki dokumentów jednocześnie i przetwarzaj je w tle.",
            },
            {
              icon: Download,
              title: "Eksport wyników",
              desc: "Pobieraj wyniki w formacie CSV, JSON lub XML do dalszej analizy.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/50 bg-card/50 p-6 text-left space-y-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-4 text-center text-sm text-muted-foreground">
        © 2024 DocSage — Inteligentna analiza dokumentów
      </footer>
    </div>
  );
}
