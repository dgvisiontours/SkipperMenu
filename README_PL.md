# Paszowóz — aplikacja do zamówień na rejs

Gotowa aplikacja PWA dla sterników i zaopatrzeniowca. Działa w przeglądarce oraz może zostać dodana do ekranu głównego iPhone’a i telefonu z Androidem.

## Co już działa

- katalog produktów odczytanych z pliku Excel i późniejszych zmian zaopatrzeniowych;
- ilości, kategorie, wyszukiwarka oraz jednostki;
- osobna baza śniadań z przepisami, składnikami i wskazówkami do przygotowania na jachcie;
- obowiązkowy profil diet załogi przed pierwszym zamówieniem: wege, bez laktozy, bez glutenu i inne;
- obowiązkowy typ jachtu (rekreacyjny, szkoleniowy lub wyprawowy) oraz liczebność załogi z podziałem na kobiety i mężczyzn;
- możliwość późniejszej edycji diet oraz specjalne prośby w zamówieniu;
- przycisk **Nowy turnus**, który bez tworzenia nowego konta zmienia jacht i profil diet załogi;
- obowiązkowy wybór miejsca przy zamówieniu: **W Rejsie** albo **W Zofiówce**;
- panel zaopatrzeniowca pokazujący miejsce każdego jachtu i łączną liczbę osób na aktywnych jachtach;
- zbiorcze podsumowanie liczby osób na poszczególnych dietach;
- dodatkowe potwierdzenie przed rozpoczęciem nowego turnusu;
- jedno zamówienie jachtu na następny dzień, z możliwością poprawiania wyłącznie między 09:00 a 15:00;
- blokada przed 09:00 i po 15:00 egzekwowana również w bazie danych;
- panel zaopatrzeniowca: suma produktów z filtrem wszystko / W Rejsie / W Zofiówce / Wyprawa, rozpiska na jachty, brakujące zamówienia;
- lista zaopatrzeniowa pogrupowana kategoriami; produkty z kategorii **Pieczywo** trafiają na raport dzień później niż reszta zamówienia;
- przy produkcie można dopisać **rodzaj** / wariant, który trafia do osobnej kolumny raportu;
- specjalne prośby i zamienniki są dodawane jako osobne pozycje listy;
- historia zamówień sternika pokazująca wcześniejsze paczki do kontroli dostawy;
- eksport listy zakupów do CSV i drukowanie/zapis do PDF;
- logowanie i role: sternik, zaopatrzeniowiec, administrator;
- wybrane konta sterników mogą dodatkowo widzieć raport zaopatrzenia i usuwać konta użytkowników;
- instalacja jako PWA na iOS i Androidzie.

## Potrzebne narzędzia

1. **Supabase** — baza danych, konta użytkowników i bezpieczeństwo. Wystarczy darmowy plan.
2. **Netlify** — hosting aplikacji z HTTPS. Na początek wystarczy darmowy plan.
3. Dowolny edytor tekstu, np. Visual Studio Code, do uzupełnienia `config.js`.
4. Opcjonalnie GitHub — do przechowywania kodu i automatycznych wdrożeń.
5. Opcjonalnie własna domena.

Nie trzeba tworzyć osobnych aplikacji w App Store ani Google Play. PWA jest najprostszym rozwiązaniem dla 15–20 jachtów: jeden link, jedna wersja i brak procesu zatwierdzania przez sklepy.

## Wdrożenie krok po kroku

### 1. Utwórz backend w Supabase

1. Wejdź na [supabase.com](https://supabase.com), utwórz konto i nowy projekt.
2. W projekcie otwórz **SQL Editor** → **New query**.
3. Wklej całą zawartość pliku `schema.sql` i wybierz **Run**.
4. Otwórz **Authentication** → **Providers** → **Email**.
5. Na testy możesz wyłączyć **Confirm email**. Produkcyjnie lepiej pozostawić potwierdzanie adresu włączone.
6. Otwórz **Project Settings** → **Data API / API** i skopiuj:
   - Project URL,
   - klucz `anon` / `publishable` (to klucz publiczny; nie używaj `service_role`).

Jeżeli aktualizujesz już działającą wersję aplikacji, ponownie uruchom cały aktualny
plik `schema.sql` w SQL Editor. Doda on pole profilu diet i wymagane funkcje bez
usuwania istniejących użytkowników ani zamówień.

### 2. Połącz aplikację z Supabase

W pliku `config.js`:

1. wpisz skopiowany adres jako `SUPABASE_URL`;
2. wpisz publiczny klucz jako `SUPABASE_ANON_KEY`;
3. zmień `DEMO_MODE: true` na `DEMO_MODE: false`.

Przykład:

```js
export const CONFIG = {
  SUPABASE_URL: "https://abcdefgh.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
  DEMO_MODE: false,
  TIMEZONE: "Europe/Warsaw",
  ORDER_OPEN_HOUR: 9,
  CUTOFF_HOUR: 15,
};
```

Ważne: `SUPABASE_URL` musi kończyć się na `.supabase.co`. Nie dopisuj
`/rest/v1`, `/auth/v1` ani końcowego ukośnika. Poprawny przykład:

```text
https://abcdefgh.supabase.co
```

### 3. Opublikuj aplikację na Netlify

Najprościej:

1. Wejdź na [app.netlify.com](https://app.netlify.com) i zaloguj się.
2. Wybierz **Add new site** → **Deploy manually**.
3. Przeciągnij cały folder `zamowienia-rejs` na pole wdrożenia.
4. Netlify poda adres podobny do `https://nazwa.netlify.app`.
5. W Supabase wejdź w **Authentication** → **URL Configuration**:
   - ustaw **Site URL** na adres Netlify,
   - dodaj ten sam adres do **Redirect URLs**.

Przy każdej aktualizacji przeciągnij folder ponownie albo połącz Netlify z repozytorium GitHub.

### 4. Utwórz użytkowników

Każdy sternik:

1. otwiera adres aplikacji;
2. wybiera **Nowe konto**;
3. podaje nazwę jachtu, imię, e-mail i hasło;
4. po potwierdzeniu e-maila może składać zamówienia.

Nazwa jachtu musi być unikalna. Jeśli konto zostało utworzone przez pomyłkę, usuń użytkownika w Supabase w **Authentication → Users**, a następnie usuń nieużywany jacht w **Table Editor → boats**.

### 5. Nadaj rolę zaopatrzeniowca

Zaopatrzeniowiec najpierw rejestruje zwykłe konto (w polu jacht może wpisać np. „KONTO ZAOPATRZENIA”). Potem w **SQL Editor** wykonaj:

```sql
do $$
declare v_user uuid; v_boat uuid;
begin
  select p.id, p.boat_id into v_user, v_boat
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'zaopatrzenie@example.com';

  update public.boats set active = false where id = v_boat;
  update public.profiles set role = 'supplier', boat_id = null where id = v_user;
end $$;
```

Po ponownym zalogowaniu zobaczy tylko raport zaopatrzenia, a techniczny jacht nie będzie liczony jako brakujące zamówienie. Sternikowi zarządzającemu można nadać rolę `admin`; zobaczy oba panele i zachowa swój jacht.

## Instalacja na telefonie

### iPhone / iPad

1. Otwórz link w Safari.
2. Naciśnij ikonę udostępniania.
3. Wybierz **Dodaj do ekranu początkowego**.
4. Zatwierdź nazwę „Paszowóz”.

### Android

1. Otwórz link w Chrome.
2. Otwórz menu `⋮`.
3. Wybierz **Zainstaluj aplikację** lub **Dodaj do ekranu głównego**.

Hosting musi działać przez HTTPS — Netlify zapewnia go automatycznie.

## Codzienny sposób pracy

1. Sternik omawia z załogą potrzeby na następny dzień.
2. Między 09:00 a 15:00 wybiera produkty, wpisuje ilości i specjale.
3. Może zapisywać poprawki wielokrotnie; liczy się ostatnia wersja.
4. Przed 09:00 i po 15:00 konto sternika nie może zmienić zamówienia.
5. Zaopatrzeniowiec otwiera raport na dzień wydania:
   - kupuje według listy skonsolidowanej;
   - pakuje produkty według kart poszczególnych jachtów;
   - widzi, które jachty nie złożyły zamówienia.

Wybrane konta sterników z listy w `schema.sql` pozostają zwykłymi sternikami, ale w aplikacji widzą
również raport zaopatrzenia oraz osobną zakładkę **Usuwanie kont**. Jeśli takie konto nie ma jeszcze
przypisanego jachtu, może użyć przycisku **Nowy turnus**, który utworzy i przypisze nowy jacht.

## Rozpoczęcie kolejnego turnusu

Po zakończeniu turnusu sternik wybiera **Nowy turnus** w górnym pasku aplikacji,
podaje nazwę i typ kolejnego jachtu, liczebność załogi, podział na kobiety i mężczyzn
oraz diety. Poprzedni jacht zostaje
dezaktywowany, ale jego wcześniejsze zamówienia pozostają w historii. Konto, e-mail
i hasło sternika nie zmieniają się.

## Ważne decyzje przed startem

- Jednostki zostały dobrane na podstawie praktycznego znaczenia produktów w arkuszu. Przed rejsem warto je przejrzeć w tabeli `products` w Supabase.
- Wersja obecna przyjmuje zamówienia wyłącznie na następny dzień.
- Deadline korzysta ze strefy `Europe/Warsaw`, również podczas zmiany czasu letniego.
- Aplikacja buforuje interfejs, ale wysłanie zamówienia wymaga internetu. Na Mazurach warto zapisywać wcześniej, gdy jest zasięg.
- Publiczny klucz `anon` może znajdować się w aplikacji. Nigdy nie wklejaj do niej tajnego klucza `service_role`.

## Dalsze rozszerzenia

W następnej wersji można dodać: powiadomienia o 17:00, panel zarządzania katalogiem, wybór portu dostawy, historię i kopiowanie zamówień, potwierdzanie wydania paczki oraz natywną publikację przez Capacitor do App Store i Google Play.
