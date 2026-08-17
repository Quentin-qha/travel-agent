export type Locale = "fr" | "en";

const fr = {
  common: {
    error: {
      generic: "Une erreur est survenue.",
      status: "Erreur {status}",
    },
    day: "jour",
    days: "jours",
  },
  travelFormPage: {
    title: "Planifie ton voyage",
    greeting: "Salut {name}, planifie ton voyage",
    subtitle: "Réponds à quelques questions, on s'occupe du reste.",
    libraryLink: "Voir des idées de voyages",
  },
  steps: {
    stay: "Séjour",
    tripType: "Type de voyage",
    summary: "Résumé",
  },
  travelForm: {
    fields: {
      destination: "Où veux-tu aller ?",
      when: "Quand ?",
      who: "Qui part ?",
      tripType: "Quel type de voyage cherches-tu ?",
    },
    success: {
      heading: "Ton voyage est prêt !",
      permalink: "Lien permanent vers ce voyage",
      restart: "Créer un nouveau voyage",
    },
  },
  stepFooter: {
    previous: "Précédent",
    next: "Suivant",
    generate: "Générer",
    generating: "Génération...",
  },
  summaryStep: {
    heading: "Vérifie ton voyage avant de le générer",
    destination: "Destination",
    dates: "Dates",
    travelers: "Voyageurs",
    moods: "Ambiances",
    person: "personne",
    people: "personnes",
  },
  tripTypeSelect: {
    helper: "Choisis jusqu'à {max} ambiances",
  },
  travelerTypes: {
    solo: "Solo",
    couple: "Couple",
    famille: "Famille",
    amis: "Amis",
    groupe: "Groupe",
  },
  travelerPicker: {
    count: "Voyageurs",
  },
  cityAutocomplete: {
    placeholder: "Rechercher une ville (ex : Lisbonne, Kyoto...)",
    remove: "Retirer {name}",
    noResults: "Aucune ville trouvée",
  },
  dateRangePicker: {
    placeholder: "Sélectionner les dates",
    prevMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    clear: "Effacer",
    confirm: "Valider",
  },
  generationLoader: {
    steps: [
      "Planification du séjour...",
      "Recherche des meilleures adresses...",
      "Analyse des avis et des lieux...",
      "Organisation de l'itinéraire jour par jour...",
      "Application sur la carte...",
      "Derniers ajustements...",
    ],
  },
  itineraryResult: {
    source: "Source",
  },
  itineraryMap: {
    mapLoading: "Chargement de la carte…",
    editMode: "Mode édition",
    noneSelected: "Aucun élément sélectionné",
    regenerate: "Régénérer",
    changeSelected: "Changer les éléments sélectionnés ({count})",
    regenerating: "Génération…",
    cancel: "Annuler",
    yourTripTo: "Votre voyage à",
    copyLink: "Copier le lien de partage",
    editTrip: "Modifier le voyage",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",
    emptyDay: "Rien de prévu ce jour-là.",
    dayLabel: "Jour",
    all: "Tout",
    linkCopied: "Lien de partage copié",
    samePlace: "{count} lieux à cet endroit",
    expandMap: "Agrandir la carte",
    collapseMap: "Réduire la carte",
  },
  library: {
    heading: "Bibliothèque de voyages",
    newTrip: "Nouveau voyage",
    emptyState: "Aucun voyage généré pour l'instant.",
    planFirst: "Planifier ton premier voyage",
    toolbar: {
      searchPlaceholder: "Rechercher une destination...",
      clearSearch: "Effacer la recherche",
    },
    browser: {
      noResults: "Aucun voyage ne correspond à ta recherche.",
      resetFilters: "Réinitialiser les filtres",
    },
    card: {
      viewTrip: "Voir le voyage",
    },
    dayFilter: {
      label: "Durée",
      reset: "Réinitialiser",
      ariaMin: "Nombre de jours minimum",
      ariaMax: "Nombre de jours maximum",
    },
  },
};

const en: typeof fr = {
  common: {
    error: {
      generic: "Something went wrong.",
      status: "Error {status}",
    },
    day: "day",
    days: "days",
  },
  travelFormPage: {
    title: "Let's plan your trip",
    greeting: "Hi {name}, let's plan your trip",
    subtitle: "Answer a few questions, we'll handle the rest.",
    libraryLink: "See trip ideas",
  },
  steps: {
    stay: "Trip",
    tripType: "Trip type",
    summary: "Summary",
  },
  travelForm: {
    fields: {
      destination: "Where do you want to go?",
      when: "When?",
      who: "Who's going?",
      tripType: "What kind of trip are you looking for?",
    },
    success: {
      heading: "Your trip is ready!",
      permalink: "Permanent link to this trip",
      restart: "Plan a new trip",
    },
  },
  stepFooter: {
    previous: "Previous",
    next: "Next",
    generate: "Generate",
    generating: "Generating...",
  },
  summaryStep: {
    heading: "Review your trip before generating it",
    destination: "Destination",
    dates: "Dates",
    travelers: "Travelers",
    moods: "Moods",
    person: "person",
    people: "people",
  },
  tripTypeSelect: {
    helper: "Choose up to {max} moods",
  },
  travelerTypes: {
    solo: "Solo",
    couple: "Couple",
    famille: "Family",
    amis: "Friends",
    groupe: "Group",
  },
  travelerPicker: {
    count: "Travelers",
  },
  cityAutocomplete: {
    placeholder: "Search for a city (e.g. Lisbon, Kyoto...)",
    remove: "Remove {name}",
    noResults: "No city found",
  },
  dateRangePicker: {
    placeholder: "Select dates",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    clear: "Clear",
    confirm: "Confirm",
  },
  generationLoader: {
    steps: [
      "Planning your trip...",
      "Searching for the best spots...",
      "Analyzing reviews and places...",
      "Organizing the itinerary day by day...",
      "Plotting it on the map...",
      "Final touches...",
    ],
  },
  itineraryResult: {
    source: "Source",
  },
  itineraryMap: {
    mapLoading: "Loading map…",
    editMode: "Edit mode",
    noneSelected: "No item selected",
    regenerate: "Regenerate",
    changeSelected: "Change selected items ({count})",
    regenerating: "Generating…",
    cancel: "Cancel",
    yourTripTo: "Your trip to",
    copyLink: "Copy share link",
    editTrip: "Edit trip",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    emptyDay: "Nothing planned for this day.",
    dayLabel: "Day",
    all: "All",
    linkCopied: "Share link copied",
    samePlace: "{count} places here",
    expandMap: "Expand map",
    collapseMap: "Collapse map",
  },
  library: {
    heading: "Trip library",
    newTrip: "New trip",
    emptyState: "No trips generated yet.",
    planFirst: "Plan your first trip",
    toolbar: {
      searchPlaceholder: "Search for a destination...",
      clearSearch: "Clear search",
    },
    browser: {
      noResults: "No trip matches your search.",
      resetFilters: "Reset filters",
    },
    card: {
      viewTrip: "View trip",
    },
    dayFilter: {
      label: "Duration",
      reset: "Reset",
      ariaMin: "Minimum number of days",
      ariaMax: "Maximum number of days",
    },
  },
};

export const TRANSLATIONS: Record<Locale, typeof fr> = { fr, en };
