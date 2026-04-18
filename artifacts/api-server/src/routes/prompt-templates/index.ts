import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DEFAULT_TEMPLATES = [
  {
    name: "Ekstrakcja danych z umowy",
    description: "Wydobywa kluczowe informacje z umów prawnych",
    extractionPrompt:
      "Wyodrębnij z dokumentu następujące informacje:\n- Strony umowy (nazwy i dane)\n- Data zawarcia umowy\n- Miejsce zawarcia umowy\n- Przedmiot umowy\n- Kwoty wynagrodzenia\n- Terminy płatności\n- Okres obowiązywania umowy",
    analysisPrompt:
      "Na podstawie wyodrębnionych danych przygotuj podsumowanie umowy oraz wskaż najważniejsze ryzyka i obowiązki stron.",
    category: "Prawne",
  },
  {
    name: "Analiza faktury",
    description: "Wydobywa dane z faktur i dokumentów finansowych",
    extractionPrompt:
      "Wyodrębnij z faktury:\n- Numer faktury\n- Data wystawienia\n- Sprzedawca (nazwa, NIP, adres)\n- Nabywca (nazwa, NIP, adres)\n- Pozycje (nazwa, ilość, cena netto, VAT, cena brutto)\n- Suma netto\n- Suma VAT\n- Suma brutto\n- Termin płatności",
    analysisPrompt:
      "Przygotuj zestawienie finansowe na podstawie wyodrębnionych danych, oblicz sumy i wskaż ewentualne niezgodności.",
    category: "Finansowe",
  },
  {
    name: "Ekstrakcja danych personalnych",
    description: "Wydobywa dane osobowe z formularzy i dokumentów HR",
    extractionPrompt:
      "Wyodrębnij następujące dane:\n- Imię i nazwisko\n- Data urodzenia\n- PESEL lub numer dokumentu\n- Adres zamieszkania\n- Telefon kontaktowy\n- Adres e-mail\n- Wykształcenie\n- Doświadczenie zawodowe",
    analysisPrompt:
      "Przygotuj profil osoby na podstawie wyodrębnionych danych w formacie strukturyzowanym.",
    category: "HR",
  },
  {
    name: "Raport z dokumentu medycznego",
    description: "Wydobywa informacje z dokumentacji medycznej",
    extractionPrompt:
      "Wyodrębnij z dokumentacji medycznej:\n- Dane pacjenta\n- Data wizyty/badania\n- Rozpoznanie/diagnoza\n- Zalecone leczenie\n- Przepisane leki\n- Kolejne wizyty\n- Wyniki badań",
    analysisPrompt:
      "Przygotuj czytelne podsumowanie stanu zdrowia pacjenta i zaleceń lekarskich.",
    category: "Medyczne",
  },
  {
    name: "Protokół spotkania",
    description: "Wydobywa kluczowe informacje z protokołów i notatek ze spotkań",
    extractionPrompt:
      "Wyodrębnij z protokołu:\n- Data i miejsce spotkania\n- Uczestnicy\n- Porządek obrad\n- Podjęte decyzje\n- Przypisane zadania (osoba, zadanie, termin)\n- Kolejne spotkanie",
    analysisPrompt:
      "Przygotuj czytelne podsumowanie spotkania z listą akcji do wykonania.",
    category: "Administracyjne",
  },
  {
    name: "Analiza oferty handlowej",
    description: "Wydobywa informacje z ofert i dokumentów przetargowych",
    extractionPrompt:
      "Wyodrębnij z oferty:\n- Oferent (nazwa, dane kontaktowe)\n- Przedmiot oferty\n- Specyfikacja produktów/usług\n- Cennik\n- Warunki płatności\n- Termin realizacji\n- Warunki gwarancji",
    analysisPrompt:
      "Porównaj warunki oferty z wymaganiami i przygotuj raport oceniający kluczowe parametry.",
    category: "Handlowe",
  },
];

router.get("/prompt-templates/defaults", async (req, res): Promise<void> => {
  res.json(DEFAULT_TEMPLATES);
});

export default router;
