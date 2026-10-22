const embeddedModuleTwo = [
  {
    label: 'Prima distinzione',
    title: 'Batteri e virus: due biologie diverse',
    intro: 'I batteri sono cellule. I virus non sono cellule e, per produrre nuove particelle virali, usano i meccanismi delle cellule che infettano. Questa differenza cambia completamente i possibili bersagli dei farmaci.',
    visual: `<div class="microbe-duo"><article class="organism-profile bacteria-profile"><img src="public/outreach/assets/microbe-bacteria.png" alt="Illustrazione editoriale di batteri" loading="eager" decoding="async"><div><span>BATTERI</span><h4>Organismi cellulari</h4><p>Possiedono strutture e processi propri, come parete, membrane e ribosomi. Molti sono innocui o utili; alcuni possono causare infezioni.</p></div></article><article class="organism-profile virus-profile"><img src="public/outreach/assets/microbe-virus.png" alt="Illustrazione editoriale di particelle virali" loading="eager" decoding="async"><div><span>VIRUS</span><h4>Parassiti intracellulari obbligati</h4><p>Contengono materiale genetico in un involucro e si replicano soltanto entrando in cellule ospiti compatibili.</p></div></article></div>`,
    takeaway: '“Microrganismo” non significa automaticamente “batterio”: identificare il tipo di agente è essenziale per parlare correttamente di terapia.',
    sources: [['ECDC · Factsheet per il pubblico','https://www.ecdc.europa.eu/en/antimicrobial-resistance/facts/factsheets/general-public'],['WHO · AMR fact sheet, 2026','https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance']]
  },
  {
    label: 'Il bersaglio',
    title: 'Un antibiotico cerca strutture batteriche',
    intro: 'Le diverse classi di antibiotici interferiscono con bersagli presenti nei batteri. Un virus non possiede quegli stessi apparati: per questo un antibiotico non può eliminare raffreddore o influenza.',
    visual: `<div class="target-board"><section class="bacterial-targets"><p class="target-board-title">BERSAGLI POSSIBILI NEL BATTERIO</p><div><article><span class="target-symbol wall-symbol" aria-hidden="true"></span><strong>Parete</strong><small>costruzione dell’involucro</small></article><article><span class="target-symbol ribosome-symbol" aria-hidden="true"></span><strong>Ribosoma</strong><small>sintesi delle proteine</small></article><article><span class="target-symbol dna-symbol" aria-hidden="true"></span><strong>DNA e metabolismo</strong><small>replicazione e vie essenziali</small></article></div></section><section class="virus-no-target"><img src="public/outreach/assets/microbe-virus.png" alt="" loading="lazy" decoding="async"><div><strong>Nel virus questi bersagli non ci sono</strong><p>Le infezioni virali, quando richiedono una terapia specifica, si trattano con antivirali adatti a quel virus e a quel quadro clinico.</p></div></section></div>`,
    takeaway: '“Non funziona contro i virus” non significa che gli antibiotici siano deboli: significa che sono progettati per altri bersagli biologici.',
    sources: [['ECDC · Che cosa sono gli antibiotici','https://www.ecdc.europa.eu/en/antimicrobial-resistance/facts/factsheets/general-public'],['WHO Europe · Antimicrobial resistance','https://www.who.int/europe/news-room/fact-sheets/item/antimicrobial-resistance']]
  },
  {
    label: 'Dal sintomo alla causa',
    title: 'Il sintomo non identifica il microrganismo',
    intro: 'Febbre, tosse o mal di gola descrivono ciò che una persona avverte, non la causa. Quadri simili possono dipendere da virus, batteri o condizioni non infettive.',
    visual: `<div class="symptom-map"><div class="symptom-core"><span>SEGNALI OSSERVATI</span><strong>febbre</strong><strong>tosse</strong><strong>mal di gola</strong></div><div class="cause-lanes"><article class="cause-virus"><b>Possibile causa virale</b><p>Per esempio influenza o molte infezioni respiratorie comuni.</p></article><article class="cause-bacteria"><b>Possibile causa batterica</b><p>Per esempio alcune polmoniti, faringiti o infezioni urinarie.</p></article><article class="cause-other"><b>Possibile causa non infettiva</b><p>Infiammazione, allergia o altre condizioni possono produrre segnali sovrapposti.</p></article></div></div>`,
    takeaway: 'La scelta non può essere “sintomo = antibiotico”: servono valutazione clinica e, quando appropriato, esami diagnostici.',
    sources: [['AIFA · Uso consapevole degli antibiotici 2025','https://www.aifa.gov.it/campagna-sull-uso-consapevole-degli-antibiotici-2025'],['WHO Europe · Stewardship e diagnostica','https://www.who.int/europe/news-room/fact-sheets/item/antimicrobial-resistance']]
  },
  {
    label: 'Un errore frequente',
    title: 'Raffreddore e influenza non si curano con antibiotici',
    intro: 'Raffreddore e influenza sono causati da virus. Prendere un antibiotico non elimina il virus e non abbassa automaticamente febbre, tosse o starnuti.',
    visual: `<div class="viral-example"><div class="viral-example-art"><img src="public/outreach/assets/microbe-virus.png" alt="Illustrazione editoriale di virus" loading="lazy" decoding="async"><span>INFEZIONE VIRALE</span></div><div class="viral-example-grid"><article><strong>Raffreddore</strong><p>Gli antibiotici non agiscono sui virus responsabili.</p></article><article><strong>Influenza</strong><p>Un antibiotico non sostituisce la valutazione né un eventuale antivirale indicato.</p></article><article class="viral-caveat"><strong>La cautela che conta</strong><p>Un’infezione virale può talvolta complicarsi o coesistere con un’infezione batterica. Solo la valutazione professionale distingue i quadri.</p></article></div></div>`,
    takeaway: 'Assumere un antibiotico “per sicurezza” espone a effetti indesiderati e aumenta la pressione selettiva senza offrire beneficio contro il virus.',
    sources: [['ECDC · Uso inappropriato','https://www.ecdc.europa.eu/en/antimicrobial-resistance/facts/factsheets/general-public'],['AIFA · Campagna 2025','https://www.aifa.gov.it/campagna-sull-uso-consapevole-degli-antibiotici-2025']]
  },
  {
    label: 'La decisione',
    title: 'La prescrizione è un percorso, non un automatismo',
    intro: 'L’uso appropriato integra la probabilità di un’infezione batterica, la gravità, le caratteristiche della persona, le linee guida e, quando utili, i test diagnostici.',
    visual: `<div class="clinical-path"><article><span>01</span><strong>Valutare</strong><p>Sintomi, esame clinico, durata, fattori di rischio e possibili diagnosi alternative.</p></article><i aria-hidden="true">→</i><article><span>02</span><strong>Documentare</strong><p>Usare test microbiologici o altri esami quando possono cambiare la decisione.</p></article><i aria-hidden="true">→</i><article><span>03</span><strong>Scegliere</strong><p>Se necessario, selezionare farmaco, dose, via e durata secondo evidenze e dati locali.</p></article><i aria-hidden="true">→</i><article><span>04</span><strong>Rivalutare</strong><p>Controllare risposta ed esiti; modificare la strategia quando emergono nuove informazioni.</p></article></div>`,
    takeaway: 'Appropriato non significa “mai antibiotici”: significa usarli quando il beneficio atteso supera i rischi, con il farmaco e il regime più adatti.',
    sources: [['WHO Europe · AMR e stewardship','https://www.who.int/europe/news-room/fact-sheets/item/antimicrobial-resistance'],['AIFA · Uso consapevole 2025','https://www.aifa.gov.it/campagna-sull-uso-consapevole-degli-antibiotici-2025']]
  },
  {
    label: 'Comportamenti utili',
    title: 'Sei regole proteggono persone e terapie',
    intro: 'L’efficacia degli antibiotici è una risorsa condivisa. Le azioni individuali non sostituiscono la responsabilità dei sistemi sanitari, ma contribuiscono a ridurre uso improprio e infezioni evitabili.',
    visual: `<div class="appropriate-use-list"><article><span>1</span><p><strong>Consultare</strong> medico o professionista sanitario prima di assumere un antibiotico.</p></article><article><span>2</span><p><strong>Seguire</strong> dose, orari e durata prescritti; chiedere chiarimenti se qualcosa non è comprensibile.</p></article><article><span>3</span><p><strong>Non condividere</strong> antibiotici con altre persone, anche se i sintomi sembrano uguali.</p></article><article><span>4</span><p><strong>Non riutilizzare</strong> avanzi per una nuova malattia senza una nuova valutazione.</p></article><article><span>5</span><p><strong>Smaltire correttamente</strong> i medicinali residui chiedendo indicazioni al farmacista.</p></article><article><span>6</span><p><strong>Prevenire</strong> le infezioni con igiene, vaccinazioni appropriate e comportamenti raccomandati.</p></article></div>`,
    takeaway: 'Non interrompere, prolungare o modificare autonomamente una terapia: se compaiono problemi o dubbi, contattare chi l’ha prescritta.',
    sources: [['ECDC · Cosa possono fare i pazienti','https://www.ecdc.europa.eu/en/antimicrobial-resistance/facts/factsheets/general-public'],['AIFA · Uso consapevole 2025','https://www.aifa.gov.it/campagna-sull-uso-consapevole-degli-antibiotici-2025']]
  }
];

function renderEmbeddedModuleTwo(detail, deckUrl) {
  renderEmbeddedDeck(detail, deckUrl, {
    slides: embeddedModuleTwo,
    moduleTitle: 'Batteri, virus e uso appropriato',
    moduleLabel: 'Secondo modulo completo.',
    completionText: 'Sei schede consultabili online, con esempi divulgativi, cautele cliniche e fonti istituzionali.'
  });
}