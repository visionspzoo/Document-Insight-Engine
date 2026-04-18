import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center gap-6 bg-background text-foreground">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nie znaleziono strony</h1>
        <p className="text-muted-foreground mt-2">Strona, której szukasz, nie istnieje lub została przeniesiona.</p>
      </div>
      <Link href="/dashboard">
        <Button className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Wróć do pulpitu
        </Button>
      </Link>
    </div>
  );
}
