// Accurivo — translations (English + Latviešu). English is the source; every other
// language maps English phrases → translated phrases. Unknown text passes through.
(function () {
  'use strict';
  if (window.ACCURIVO_I18N) return;

  var LANGS = { en: 'English', lv: 'Latviešu' };

  // capture the RAW getters/setters BEFORE patching (or we recurse forever)
  var proto = typeof Element !== 'undefined' ? Element.prototype : null;
  var rawGetIH = null, rawSetIH = null;
  if (proto) {
    try {
      var d = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
      if (d) { rawGetIH = d.get; rawSetIH = d.set; }
    } catch (e) {}
  }
  var nproto = typeof Node !== 'undefined' ? Node.prototype : null;
  var rawGetTC = null, rawSetTC = null;
  if (nproto) {
    try {
      var d2 = Object.getOwnPropertyDescriptor(nproto, 'textContent');
      if (d2) { rawGetTC = d2.get; rawSetTC = d2.set; }
    } catch (e) {}
  }

  var DICT = {
    en: {},
    lv: {
      'Dashboard': 'Pārskats', 'Documents': 'Dokumenti', 'Customers & suppliers': 'Klienti un piegādātāji',
      'My stock': 'Mans krājums', 'Scanned originals': 'Skenētie origināli', 'Settings': 'Iestatījumi',
      'Log out': 'Izrakstīties', 'Welcome back': 'Laipni lūdzam atpakaļ',
      'Sign in to your company workspace': 'Pieslēdzieties savas uzņēmuma darbvietai', 'Sign in': 'Ieiet',
      'New company? Create one': 'Jauns uzņēmums? Izveidojiet to', 'Create a company workspace': 'Izveidot uzņēmuma darbvietu',
      'One workspace for your whole company': 'Viena darbvieta visam jūsu uzņēmumam',
      'Company name': 'Uzņēmuma nosaukums', 'Your name': 'Jūsu vārds', 'Email': 'E-pasts', 'Password': 'Parole',
      'Create workspace': 'Izveidot darbvietu', 'Already have an account? Sign in': 'Jau ir konts? Ieejiet',
      'Two-step verification': 'Divpakāpju verificēšana', 'Enter the 6-digit code from your app': 'Ievadiet 6 ciparu kodu no savas lietotnes',
      'Verify': 'Apstiprināt', 'Who owes you': 'Kas jums parādā', 'You owe suppliers': 'Jūs parādāt piegādātājiem',
      'Documents this month': 'Dokumenti šomēnes', 'Unpaid documents': 'Nesamaksātie dokumenti',
      'No unpaid documents yet': 'Vēl nav nesamaksātu dokumentu', 'Number': 'Numurs', 'Customer': 'Klients',
      'Amount': 'Summa', 'Due date': 'Apmaksas termiņš', 'Search documents': 'Meklēt dokumentus',
      'Statistics': 'Statistika', 'Realization (invoiced)': 'Realizācija (izrēķināts)', 'Expenses (bills)': 'Izmaksas (rēķini no piegādātājiem)',
      'Profit': 'Peļņa', 'Deficit': 'Deficīts', 'Saldo (received − paid out)': 'Saldo (saņemts − samaksāts)',
      'Customers owe you': 'Klienti jums parādā', 'Overdue total': 'Kavēts kopā', 'Money received': 'Saņemtā nauda',
      'Realization by period': 'Realizācija pa periodiem', 'Weeks': 'Nedēļas', 'Months': 'Mēneši', 'Quarters': 'Ceturkšņi',
      'All payment states': 'Visi maksājumu stāvokļi', 'Unpaid': 'Nesamaksāts',
      'PPD (goods delivery)': 'Preču piegādes dokuments (PPD)', 'New PPD': 'Jauns PPD',
      'Mark as ordered (goods in stock)': 'Atzīmēt kā pasūtītu (preces noliktavā)',
      'Goods received — create PPD': 'Preces saņemtas — izveidot PPD',
      'Goods are in stock (PPD created)': 'Preces ir noliktavā (PPD izveidots)',
      'Movements': 'Kustības',
      'Goods enter stock when a bill is marked as ordered, or via a PPD (goods delivery). Selling (sent invoice) takes them out.': 'Preces nonāk noliktavā, kad rēķins no piegādātāja ir atzīmēts kā pasūtīts, vai izveidojot PPD (preču piegādes dokumentu). Pārdodot (nosūtīts rēķins) preces tiek izņemtas.',
      'All types': 'Visi tipi', 'Invoices': 'Rēķini', 'Quotes': 'Piedāvājumi', 'Bills (purchases)': 'Pirkuma rēķini',
      'CMR waybills': 'CMR kravas pavaddokumenti', 'Newest first': 'Jaunākie augšā', 'Oldest first': 'Vecākie augšā',
      'Amount largest → smallest': 'Summa lielākā → mazākā', 'Amount smallest → largest': 'Summa mazākā → lielākā',
      'Due soonest': 'Termiņš tuvākais', 'New invoice': 'Jauns rēķins', 'New quote': 'Jauns piedāvājums',
      'New bill': 'Jauns pirkuma rēķins', 'New CMR': 'Jauns CMR', 'Status': 'Statuss', 'Issue date': 'Izdošanas datums',
      'Nothing here yet': 'Šeit vēl nekā nav', 'New document': 'Jauns dokuments',
      'The amount on this document looks unusual — please check': 'Summa šajā dokumentā izskatās neparasta — lūdzu, pārbaudiet',
      'check': 'pārbaudīt', 'Description': 'Apraksts', 'Bank account on printout': 'Bankas konts izdrukā',
      'Line items': 'Rindas', 'Item': 'Prece', 'Part number / ID': 'Preces kods / ID', 'Qty': 'Skaits', 'Unit price': 'Vienības cena', 'Sum': 'Kopā',
      'Add line': 'Pievienot rindu', 'Save': 'Saglabāt', 'Print': 'Drukāt', 'Delete': 'Dzēst',
      'Delete document?': 'Dzēst dokumentu?', 'Document saved': 'Dokuments saglabāts', 'Generate CMR': 'Izveidot CMR',
      'Payments': 'Maksājumi', 'Quotes are not paid': 'Piedāvājumus nemaksā', 'Payment amount': 'Maksājuma summa',
      'Payment date': 'Maksājuma datums', 'Record payment': 'Fiksēt maksājumu', 'Link scan': 'Piesaistīt skenējumu',
      'Scanning…': 'Skenēšana…', 'Scan saved and linked': 'Skenējums saglabāts un piesaistīts',
      'Could not read the file': 'Failu neizdevās nolasīt', 'Amount found on the scan': 'Uz skenējuma atrasta summa',
      'Large amount — please check the document': 'Liela summa — lūdzu, pārbaudiet dokumentu',
      'Not linked': 'Nav piesaistīts', 'Attach a scanned original (PDF, photo, Excel or CSV)': 'Pievienojiet skenētu originālu (PDF, foto, Excel vai CSV)',
      'Search': 'Meklēt', 'Add contact': 'Pievienot kontaktu', 'Name': 'Nosaukums', 'Kind': 'Veids',
      'Customers': 'Klienti', 'Suppliers': 'Piegādātāji',
      'Add customer': 'Pievienot klientu', 'Add supplier': 'Pievienot piegādātāju',
      'Edit': 'Rediģēt', 'Cancel': 'Atcelt',
      'VAT no.': 'PVN nr.', 'Phone': 'Telefons', 'Import': 'Importēt', 'Export CSV': 'Eksportēt CSV',
      'Added:': 'Pievienoti:', 'Skipped:': 'Izlaisti:', 'Company': 'Uzņēmums', 'Supplier': 'Piegādātājs',
      'Person': 'Persona', 'Nothing in stock yet': 'Krājumā vēl nekā nav', 'In stock': 'Krājumā',
      'Unit cost (last)': 'Vienības izmaksas (pēdējās)', 'Stock value': 'Krājuma vērtība', 'Item name': 'Preces nosaukums',
      'File': 'Fails', 'Linked to document': 'Piesaistīts dokumentam', 'Actions': 'Darbības',
      'Language': 'Valoda', 'Company details': 'Uzņēmuma dati', 'Full company name': 'Pilns uzņēmuma nosaukums',
      'Registration no.': 'Reģistrācijas nr.', 'Address': 'Adrese', 'Logo': 'Logo', 'Bank accounts': 'Bankas konti',
      'Bank': 'Banka', 'Bank name': 'Bankas nosaukums', 'Seller': 'Pārdevējs', 'Buyer': 'Pircējs', 'Address:': 'Adrese:', 'Reg. no.:': 'Reģ. nr.:', 'VAT reg. no.:': 'PVN reģ. nr.:', 'Bank:': 'Banka:', 'Account no.:': 'Konta nr.:', 'IBAN': 'IBAN', 'SWIFT': 'SWIFT/BIC', 'Add bank': 'Pievienot banku', 'Backups': 'Rezerves kopijas',
      'Set a folder to keep copies of your data': 'Norādiet mapi, kur glabāt savu datu kopijas',
      'Backup folder': 'Rezerves kopiju mape', 'Auto-backup daily': 'Automātiska rezerves kopija katru dienu',
      'Back up now': 'Izveidot kopiju tagad', 'Download backup': 'Lejupielādēt rezerves kopiju',
      'Backup saved': 'Rezerves kopija saglabāta',
      'Restore everything from a backup file': 'Atjaunot visu no rezerves kopijas faila',
      'Before a software update: make a backup first, update, and if anything goes wrong, restore here.': 'Pirms programmatūras atjaunināšanas: vispirms izveidojiet rezerves kopiju, atjauniniet, un, ja kaut kas nogāja greizi, atjaunojiet šeit.',
      'Current data is saved as a safety copy first.': 'Pašreizējie dati vispirms tiek saglabāti kā drošības kopija.',
      'Choose a backup file': 'Izvēlieties rezerves kopijas failu', 'Restore and restart': 'Atjaunot un pārstartēt',
      'Restore': 'Atjaunot', 'Restoring — the page will reload in a moment': 'Atjaunošana — lapa drīz tiks pārlādēta',
      'Not a valid Accurivo backup': 'Nav derīga Accurivo rezerves kopija', 'Enable': 'Ieslēgt', 'Disable': 'Izslēgt',
      'Scan this in Microsoft Authenticator, then enter a code to confirm': 'Noskenējiet to Microsoft Authenticator lietotnē, tad ievadiet kodu apstiprināšanai',
      'People': 'Cilvēki', 'Add person': 'Pievienot personu', 'Load demo data': 'Ielādēt demo datus',
      'Demo data loaded': 'Demo dati ielādēti', 'Owner': 'Īpašnieks', 'User': 'Lietotājs',
      'Adds 10 example documents': 'Pievieno 10 parauga dokumentus',
      'Invoice': 'Rēķins', 'Quote': 'Piedāvājums', 'Bill': 'Pirkuma rēķins', 'CMR': 'CMR',
      'Offer': 'Piedāvājums', 'Offers': 'Piedāvājumi', 'New offer': 'Jauns piedāvājums',
      'Info lines': 'Info rindas', 'Extra info shown on the printout': 'Papildu informācija, kas redzama izdrukā',
      'Issued by (name, surname)': 'Izsniedza (vārds, uzvārds)', 'Received by (name, surname)': 'Saņēma (vārds, uzvārds)',
      'Can be left empty — filled by pen': 'Var atstāt tukšu — aizpilda ar pildspalvu',
      'Issued by': 'Izsniedza', 'Received by': 'Saņēma', 'Accepted by': 'Pieņēma', 'Date': 'Datums',
      'Show in list': 'Rādīt sarakstā',
      'Partially paid': 'Daļēji samaksāts', 'Not paid yet': 'Vēl nav samaksāts', 'Remaining': 'Atlicis',
      'Mark as sent': 'Atzīmēt kā nosūtītu', 'Mark as not sent': 'Atzīmēt kā nenosūtītu', 'Mark as paid': 'Atzīmēt kā samaksātu',
      'Extra rows with names': 'Papildu rindas ar nosaukumu', 'Add info row': 'Pievienot rindu', 'Row name': 'Rindas nosaukums', 'Text': 'Teksts',
      'Payment terms': 'Apmaksas kārtība', 'Delivery time': 'Piegādes termiņš', 'Approval terms': 'Apstiprināšanas kārtība', 'Valid until': 'Derīguma termiņš', 'Notes': 'Piezīmes',
      'Each row has a name (for example: Payment terms, Delivery time, Place of delivery) and text — all shown on the printout': 'Katrai rindai ir nosaukums (piemēram: Apmaksas kārtība, Piegādes termiņš, Piegādes vieta) un teksts — viss redzams izdrukā',
      'What was paid (note)': 'Par ko samaksāts (piezīme)',
      'Issued:': 'Izsniegts:', 'Due:': 'Termiņš:', 'Total': 'Kopā samaksāt', 'Pay to:': 'Maksāt uz:',
      'Sender': 'Sūtītājs', 'Carrier': 'Pārvadātājs', 'Consignee': 'Saņēmējs', 'Place of dispatch': 'Nosūtīšanas vieta',
      'Place of delivery': 'Piegādes vieta', 'Goods': 'Krava', 'Number of packages': 'Iepakojumu skaits',
      'Gross weight (kg)': 'Bruto masa (kg)', 'Draft': 'Melnraksts', 'Sent': 'Nosūtīts', 'Partial': 'Daļēji',
      'Paid': 'Samaksāts', 'Ordered': 'Pasūtīts', 'Received': 'Saņemts', 'Overdue': 'Nokavēts',
      'CMR consignment note': 'CMR kravas pavaddokuments',
      'Created': 'Izveidots',
      'Company details saved': 'Uzņēmuma dati saglabāti',
      'Remove logo': 'Noņemt logotipu',
      'Choose a logo image (PNG or JPG)': 'Izvēlieties logotipa attēlu (PNG vai JPG)',
    },
  };

  var VAT_WORD = { lv: 'PVN', de: 'MwSt.', fr: 'TVA', it: 'IVA', es: 'IVA', pl: 'VAT' };

  var lang = 'en';
  try {
    var saved = localStorage.getItem('accurivo-lang');
    if (saved && LANGS[saved]) lang = saved;
    else {
      var nav = (navigator.language || 'en').slice(0, 2);
      if (LANGS[nav]) lang = nav;
    }
  } catch (e) {}

  function translateText(s) {
    if (lang === 'en' || typeof s !== 'string') return s;
    var d = DICT[lang];
    var out = d && Object.prototype.hasOwnProperty.call(d, s) ? d[s] : s;
    if (out === s && VAT_WORD[lang]) out = out.replace(/\bVAT\b/g, VAT_WORD[lang]);
    return out;
  }

  // translate only text BETWEEN tags: tags and attributes stay untouched
  function translateHtml(html) {
    if (lang === 'en' || typeof html !== 'string') return html;
    return html.split(/(<[^>]*>)/).map(function (part) {
      return part.charAt(0) === '<' ? part : translateText(part);
    }).join('');
  }

  function setLang(l) {
    if (!LANGS[l]) return;
    lang = l;
    try { localStorage.setItem('accurivo-lang', l); } catch (e) {}
    try {
      document.documentElement.setAttribute('lang', l);
      var t = document.title;
      document.title = translateText(t) === t ? t : t;
      // re-render happens through the app's own setLang listener
    } catch (e) {}
    if (window.dispatchEvent) window.dispatchEvent(new Event('accurivo-lang'));
  }

  // patch prototypes so any innerHTML/textContent the app sets gets translated
  if (proto && rawSetIH) {
    try {
      Object.defineProperty(proto, 'innerHTML', {
        configurable: true,
        get: function () { return rawGetIH.call(this); },
        set: function (v) { rawSetIH.call(this, translateHtml(String(v))); },
      });
    } catch (e) {}
  }
  if (nproto && rawSetTC) {
    try {
      Object.defineProperty(nproto, 'textContent', {
        configurable: true,
        get: function () { return rawGetTC.call(this); },
        set: function (v) { rawSetTC.call(this, translateText(String(v))); },
      });
    } catch (e) {}
  }

  window.ACCURIVO_I18N = {
    LANGS: LANGS,
    DICT: DICT,
    getLang: function () { return lang; },
    setLang: setLang,
    translateText: translateText,
    translateHtml: translateHtml,
  };
})();
