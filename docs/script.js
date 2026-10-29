// My Accurivo site — English + Latviešu
(function () {
  var I18N = {
    en: {
      'nav.features': 'Features', 'nav.how': 'How it works', 'nav.faq': 'FAQ', 'nav.download': 'Download', 'nav.contact': 'Contact',
      'hero.title': 'Simple accounting for your small business',
      'hero.lead': 'Invoices, offers, supplier bills, stock (PPD), CMR waybills, payments and statistics — in one small Windows program. Works without internet. Your data stays on your computer.',
      'hero.btn': 'Download accurivo.exe', 'hero.note': 'Free to test · Windows 10/11 · ~82 MB',
      'hero.p1': 'Works offline', 'hero.p2': 'Data in one file on your computer', 'hero.p3': 'English + Latviešu',
      'shot.dashboard': 'Dashboard', 'shot.docs': 'Documents', 'shot.stock': 'My stock', 'shot.stats': 'Statistics',
      'stats.realization': 'Realization (invoiced)', 'stats.profit': 'Profit', 'stats.saldo': 'Saldo', 'stats.overdue': 'Overdue total',
      'features.title': 'Everything in one place',
      'f1.t': 'Invoices and offers', 'f1.d': 'Create, print and send invoices and offers. Automatic numbering (INV, QUO), VAT lines, your company details and bank accounts on every printout.',
      'f2.t': 'Bills from suppliers', 'f2.d': 'Record supplier bills, see what you owe, and track payments — partial payments supported.',
      'f3.t': 'Stock with PPD', 'f3.d': 'Order goods from a supplier, mark the bill as ordered, create a Preču piegādes dokuments (PPD) when goods arrive — and your stock always shows what you have and what you sold.',
      'f4.t': 'CMR waybills', 'f4.d': 'Generate a CMR from an invoice with one click. Clean one-page A4 print, trilingual LV/EN/DE.',
      'f5.t': 'Payments made simple', 'f5.d': 'Record payments with notes. Every document shows a clear banner: Paid, Partially, Overdue or Not paid yet. Overdue documents are marked red.',
      'f6.t': 'Statistics', 'f6.d': 'Profit, deficit, saldo, who owes you and whom you owe — plus a realization chart by week, month or quarter.',
      'f7.t': 'Backups you can trust', 'f7.d': 'Automatic backups to a folder you choose. Restore a backup with one click — even inside the program.',
      'f8.t': 'Multiple companies', 'f8.d': 'Keep several companies in one program. Every company sees only its own documents. Two-step verification available.',
      'how.title': 'Start in three steps',
      's1.t': 'Download', 's1.d': 'Download accurivo.exe — no installation needed.',
      's2.t': 'Double-click', 's2.d': 'The program starts and creates its data file next to itself.',
      's3.t': 'Create your workspace', 's3.d': 'Enter your company name and start working. Interface in English or Latviešu.',
      'dl.title': 'Try My Accurivo',
      'dl.lead': 'Download the program and test it with your own data. No registration, no cloud — everything stays on your computer.',
      'dl.note': 'Version 2.3.0 · Windows 10/11 · If the download does not start, the exe is not published yet — check back soon.',
      'req.os.t': 'Operating system', 'req.os.d': 'Windows 10 or 11 (64-bit). No installation — just run the exe.',
      'req.disk.t': 'Disk space', 'req.disk.d': 'About 200 MB for the program, plus room for your data and backups.',
      'req.net.t': 'Internet', 'req.net.d': 'Not needed. The program works fully offline.',
      'req.lang.t': 'Languages', 'req.lang.d': 'Latviešu and English — switch anytime inside the program.',
      'new.title': 'New in version 2.3.0',
      'new.1': 'Stock with PPD (goods delivery documents) — order goods, receive them, see what you have and what you sold.',
      'new.2': 'Overdue documents are marked red and can be filtered with one click.',
      'new.3': 'Statistics: profit, deficit, saldo and a realization chart by week, month or quarter.',
      'new.4': 'Payment filter in document search: paid / unpaid / overdue.',
      'new.5': 'Payments with notes, one-click "Mark as paid", trilingual CMR print.',
      'ct.title': 'Questions or ideas?',
      'ct.lead': 'Write to us about anything — testing feedback, problems, or wishes for the next version.',
      'faq.title': 'Questions and answers',
      'q1.t': 'Where is my data stored?', 'q1.d': 'All data is kept in one file, accurivo.db, located next to the program. You can copy or move it together with the exe wherever you like. Nothing is sent to the internet.',
      'q2.t': 'Is it safe?', 'q2.d': 'Yes — the program works locally, data never leaves your computer. Passwords are hashed, and you can turn on two-step verification for extra security.',
      'q3.t': 'How do backups work?', 'q3.d': 'Choose a backup folder in Settings. The program saves automatic copies of your database and keeps the newest 30. You can also download a backup file and restore it at any time.',
      'q4.t': 'Can I use it for several companies?', 'q4.d': 'Yes. Each company is a separate workspace with its own documents, contacts and stock. Switch between them in the program.',
      'foot.tag': 'Simple accounting for small businesses'
    },
    lv: {
      'nav.features': 'Funkcijas', 'nav.how': 'Kā tas darbojas', 'nav.faq': 'Biežie jautājumi', 'nav.download': 'Lejupielāde', 'nav.contact': 'Kontakti',
      'hero.title': 'Vienkārša grāmatvedība jūsu mazajam uzņēmumam',
      'hero.lead': 'Rēķini, piedāvājumi, rēķini no piegādātājiem, krājumi (PPD), CMR kravas vēstules, maksājumi un statistika — vienā mazā Windows programmā. Darbojas bez interneta. Jūsu dati paliek jūsu datorā.',
      'hero.btn': 'Lejupielādēt accurivo.exe', 'hero.note': 'Bezmaksas testēšanai · Windows 10/11 · ~82 MB',
      'hero.p1': 'Darbojas bez interneta', 'hero.p2': 'Dati vienā failā jūsu datorā', 'hero.p3': 'Latviešu + English',
      'shot.dashboard': 'Panelis', 'shot.docs': 'Dokumenti', 'shot.stock': 'Mans krājums', 'shot.stats': 'Statistika',
      'stats.realization': 'Realizācija (izrēķināts)', 'stats.profit': 'Peļņa', 'stats.saldo': 'Saldo', 'stats.overdue': 'Kavēts kopā',
      'features.title': 'Viss vienā vietā',
      'f1.t': 'Rēķini un piedāvājumi', 'f1.d': 'Izveidojiet, izdrukājiet un nosūtiet rēķinus un piedāvājumus. Automātiska numurēšana (INV, QUO), PVN rindas, jūsu uzņēmuma rekvizīti un banku konti katrā izdrukā.',
      'f2.t': 'Rēķini no piegādātājiem', 'f2.d': 'Reģistrējiet piegādātāju rēķinus, redziet, cik esat parādā, un sekojiet maksājumiem — atbalstīti arī daļēji maksājumi.',
      'f3.t': 'Krājumi ar PPD', 'f3.d': 'Pasūtiet preces no piegādātāja, atzīmējiet rēķinu kā pasūtītu, preču saņemšanai izveidojiet Preču piegādes dokumentu (PPD) — un krājumos vienmēr redzēsiet, kas jums ir un kas pārdots.',
      'f4.t': 'CMR kravas vēstules', 'f4.d': 'Ar vienu klikšķi ģenerējiet CMR no rēķina. Vienas A4 lapas izdruka trijās valodās LV/EN/DE.',
      'f5.t': 'Vienkārši maksājumi', 'f5.d': 'Reģistrējiet maksājumus ar piezīmēm. Katrs dokuments rāda skaidru statusu: Samaksāts, Daļēji, Kavēts vai Vēl nav samaksāts. Kavētie dokumenti ir iekrāsoti sarkanā krāsā.',
      'f6.t': 'Statistika', 'f6.d': 'Peļņa, deficīts, saldo, kas jums parādā un kam jūs parādāt — kā arī realizācijas grafiks pa nedēļām, mēnešiem vai ceturkšņiem.',
      'f7.t': 'Uzticamas rezerves kopijas', 'f7.d': 'Automātiskas rezerves kopijas jūsu izvēlētā mapē. Atjaunojiet rezerves kopiju ar vienu klikšķi — arī pašā programmā.',
      'f8.t': 'Vairāki uzņēmumi', 'f8.d': 'Turiet vairākus uzņēmumus vienā programmā. Katrs uzņēmums redz tikai savus dokumentus. Pieejama divpakāpju verificēšana.',
      'how.title': 'Sāciet trīs soļos',
      's1.t': 'Lejupielādējiet', 's1.d': 'Lejupielādējiet accurivo.exe — instalēt nav jāko.',
      's2.t': 'Atveriet ar dubultklikšķi', 's2.d': 'Programma startējas un izveido savu datu failu blakus sev.',
      's3.t': 'Izveidojiet darbvietu', 's3.d': 'Ievadiet uzņēmuma nosaukumu un sāciet strādāt. Saskarne latviešu vai angļu valodā.',
      'dl.title': 'Izmēģiniet My Accurivo',
      'dl.lead': 'Lejupielādējiet programmu un testējiet ar saviem datiem. Bez reģistrācijas, bez mākoņa — viss paliek jūsu datorā.',
      'dl.note': 'Versija 2.3.0 · Windows 10/11 · Ja lejupielāde nesākas, exe vēl nav publicēts — drīz atgriezieties.',
      'req.os.t': 'Operētājsistēma', 'req.os.d': 'Windows 10 vai 11 (64 biti). Instalēt nav jāko — vienkārši atveriet exe.',
      'req.disk.t': 'Vieta diskā', 'req.disk.d': 'Aptuveni 200 MB programmai, plus vieta datiem un rezerves kopijām.',
      'req.net.t': 'Internets', 'req.net.d': 'Nav vajadzīgs. Programma pilnībā darbojas bezsaistē.',
      'req.lang.t': 'Valodas', 'req.lang.d': 'Latviešu un angļu — pārslēdziet jebkurā laikā programmā.',
      'new.title': 'Jaunums versijā 2.3.0',
      'new.1': 'Krājumi ar PPD (preču piegādes dokumentiem) — pasūtiet preces, saņemiet tās, redziet, kas jums ir un kas pārdots.',
      'new.2': 'Kavētie dokumenti ir sarkanā krāsā un tos var atlasīt ar vienu klikšķi.',
      'new.3': 'Statistika: peļņa, deficīts, saldo un realizācijas grafiks pa nedēļām, mēnešiem vai ceturkšņiem.',
      'new.4': 'Maksājumu filtrs dokumentu meklēšanā: samaksāts / nesamaksāts / kavēts.',
      'new.5': 'Maksājumi ar piezīmēm, "Atzīmēt kā samaksātu" ar vienu klikšķi, CMR izdruka trijās valodās.',
      'ct.title': 'Jautājumi vai idejas?',
      'ct.lead': 'Rakstiet mums par visu — atsauksmes par testēšanu, problēmām vai vēlmēm nākamajai versijai.',
      'faq.title': 'Jautājumi un atbildes',
      'q1.t': 'Kur tiek glabāti mani dati?', 'q1.d': 'Visi dati ir vienā failā, accurivo.db, kas atrodas blakus programmai. Failu varat kopēt vai pārvietot kopā ar exe, kur vēlaties. Internetā nekas netiek nosūtīts.',
      'q2.t': 'Vai tas ir droši?', 'q2.d': 'Jā — programma darbojas lokāli, dati nekad nepamet jūsu datoru. Paroles ir šifrētas, un papildu drošībai var ieslēgt divpakāpju verificēšanu.',
      'q3.t': 'Kā darbojas rezerves kopijas?', 'q3.d': 'Iestatījumos izvēlieties rezerves kopiju mapi. Programma automātiski saglabā datubāzes kopijas un tur jaunākās 30. Rezerves kopiju varat arī lejupielādēt un jebkurā laikā atjaunot.',
      'q4.t': 'Vai var izmantot vairākiem uzņēmumiem?', 'q4.d': 'Jā. Katrs uzņēmums ir atsevišķa darbvieta ar saviem dokumentiem, kontaktiem un krājumiem. Programmā varat pārslēgties starp tiem.',
      'foot.tag': 'Vienkārša grāmatvedība maziem uzņēmumiem'
    }
  };
  var lang = (localStorage.getItem('site-lang') || 'lv');
  function apply() {
    document.documentElement.lang = lang;
    var dict = I18N[lang];
    var els = document.querySelectorAll('[data-t]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-t');
      if (dict[k] != null) els[i].textContent = dict[k];
    }
    document.title = lang === 'lv'
      ? 'My Accurivo — vienkārša grāmatvedība mazam uzņēmumam'
      : 'My Accurivo — simple accounting for small business';
    var b = document.getElementById('langBtn');
    b.textContent = lang === 'lv' ? 'EN' : 'LV';
    b.setAttribute('aria-label', 'Switch language');
  }
  document.getElementById('langBtn').addEventListener('click', function () {
    lang = lang === 'lv' ? 'en' : 'lv';
    localStorage.setItem('site-lang', lang);
    apply();
  });
  apply();
})();

// scroll reveal
(function(){
  var els=document.querySelectorAll(".reveal");
  if(!("IntersectionObserver" in window)){els.forEach(function(e){e.classList.add("in")});return;}
  var io=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target)}})},{threshold:0.12});
  els.forEach(function(e){io.observe(e)});
})();
