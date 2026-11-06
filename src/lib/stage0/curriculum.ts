/** Stage 0 catalogue. Preserve every supplied placement, including shared terms. */
export type SubjectId = 'polity' | 'economics' | 'geography' | 'international-relations';
export type Subject = { id: SubjectId; name: string; description: string; question: string; days: string; icon: string; categories: Category[] };
export type Category = { id: string; name: string; terms: string[] };
export type Concept = { id: string; slug: string; name: string; subject: Subject; category: Category; objective: string };
const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const category = (name: string, terms: string): Category => ({ id: slug(name), name, terms: terms.split(', ').map((s) => s.trim()) });

export const subjects: Subject[] = [
  { id: 'polity', name: 'Polity', description: 'Make sense of the rules, rights and institutions around you.', question: 'How do we live and make decisions together?', days: 'Days 1–7', icon: 'building', categories: [
    category('Basic Legal Concepts', 'Law, Legal System, Justice, Rights, Duties, Obligations, Rules, Regulations, Offence, Punishment, Courts, Legal Authority'),
    category('Basic Political Concepts', 'State, Government, Citizen, Citizenship, Country, Nation, Territory, Sovereignty, Public Authority, Public Administration'),
    category('Basic Governance Concepts', 'Constitution, Preamble, Legislature, Executive, Judiciary, Parliament, Government Departments, Public Institutions, Elections, Voting, Representation, Accountability'),
    category('Basic Rights and Freedoms', 'Human Rights, Fundamental Rights, Civil Rights, Political Rights, Equality, Liberty, Freedom of Expression, Freedom of Religion, Right to Life, Right to Property, Discrimination'),
    category('Administrative and Legal Terminology', 'Act, Bill, Amendment, Ordinance, Notification, Order, Petition, Writ, Appeal, Jurisdiction, Due Process, Natural Justice, Public Interest'),
    category('Basic Constitutional Vocabulary', 'Democratic, Republic, Secular, Socialist, Federal, Unitary, Parliamentary, Constitutional, Constitutional Authority, Constitutional Body'),
  ] },
  { id: 'economics', name: 'Economics', description: 'Understand the choices behind money, prices and everyday life.', question: 'Why does the same shopping basket cost more?', days: 'Days 8–14', icon: 'chart', categories: [
    category('Basic Economic Concepts', 'Economy, Economics, Goods, Services, Needs, Wants, Resources, Scarcity, Choice, Opportunity Cost, Production, Consumption, Distribution, Exchange, Market'),
    category('Money and Banking', 'Money, Currency, Barter System, Bank, Central Bank, Commercial Bank, Credit, Loan, Interest, Deposit, Inflation, Deflation, Purchasing Power'),
    category('Income and Employment', 'Income, Wealth, Savings, Investment, Expenditure, Employment, Unemployment, Wages, Salary, Poverty, Inequality, Standard of Living'),
    category('Government and Economy', 'Tax, Direct Tax, Indirect Tax, Government Revenue, Government Expenditure, Budget, Subsidy, Public Debt, Fiscal Policy, Monetary Policy'),
    category('National Economy', 'GDP, GNP, Per Capita Income, Economic Growth, Economic Development, Primary Sector, Secondary Sector, Tertiary Sector, Imports, Exports'),
  ] },
  { id: 'geography', name: 'Geography', description: 'Find your bearings on the planet we call home.', question: 'What makes one place different from another?', days: 'Days 15–21', icon: 'globe', categories: [
    category('Earth and Space', 'Earth, Solar System, Planet, Rotation, Revolution, Axis, Equator, Latitude, Longitude, Hemisphere, Globe, Map, Scale, Coordinates, Time Zone'),
    category('Physical Geography', 'Continent, Ocean, Sea, Island, Peninsula, Mountain, Plateau, Plain, Valley, Desert, River, Lake, Glacier, Volcano, Earthquake'),
    category('Atmosphere and Climate', 'Atmosphere, Weather, Climate, Temperature, Air Pressure, Wind, Humidity, Rainfall, Precipitation, Monsoon, Cyclone, Anticyclone, Greenhouse Effect, Global Warming'),
    category('Environment and Resources', 'Ecosystem, Biome, Biodiversity, Natural Resources, Renewable Resources, Non-Renewable Resources, Forest, Soil, Water Cycle, Erosion, Conservation'),
    category('Human Geography', 'Population, Population Density, Birth Rate, Death Rate, Migration, Urbanisation, Rural Settlement, Agriculture, Irrigation, Industrialisation'),
  ] },
  { id: 'international-relations', name: 'International Relations', description: 'Understand how countries talk, cooperate and disagree.', question: 'How do countries work things out with each other?', days: 'Days 22–28', icon: 'connections', categories: [
    category('Countries and International System', 'Country, Nation, State, Sovereignty, Territory, Border, National Interest, Foreign Policy, Diplomacy, International Relations, Bilateral Relations, Multilateral Relations, Globalisation, Geopolitics, Strategic Interest'),
    category('International Organisations', 'United Nations, Security Council, General Assembly, World Bank, International Monetary Fund, World Trade Organization, International Court of Justice, Regional Organisations, International Institutions, Treaty'),
    category('Diplomacy and Foreign Policy', 'Ambassador, High Commissioner, Embassy, Consulate, Diplomatic Mission, Summit, Dialogue, Negotiation, Mediation, Agreement, Memorandum of Understanding, Protocol, Sanctions'),
    category('International Security', 'National Security, International Security, Defence, Military Alliance, War, Conflict, Terrorism, Insurgency, Nuclear Weapons, Arms Control, Disarmament, Deterrence'),
    category('International Economic Relations', 'International Trade, Free Trade, Protectionism, Tariff, Trade Deficit, Trade Surplus, Foreign Direct Investment, Foreign Portfolio Investment, Foreign Aid, Economic Sanctions'),
  ] },
];

export const concepts: Concept[] = subjects.flatMap((subject) => subject.categories.flatMap((cat) => cat.terms.map((name) => ({
  id: `${subject.id}/${slug(name)}`, slug: slug(name), name, subject, category: cat,
  objective: `Understand ${name.toLowerCase()} in simple language and recognise it in everyday life.`,
}))));
export const uniqueConceptCount = new Set(concepts.map((c) => c.slug)).size;
export const conceptsFor = (id: SubjectId) => concepts.filter((c) => c.subject.id === id);
export const conceptPath = (c: Concept) => `/stage-0/${c.subject.id}/${c.slug}/`;
export const subjectPath = (s: Subject) => `/stage-0/${s.id}/`;

// Shared labels remain separate placements until cross-subject progress is agreed.
if (concepts.length !== 253 || uniqueConceptCount !== 248 || new Set(concepts.map((c) => c.id)).size !== concepts.length) {
  throw new Error('Stage 0 curriculum count or placement IDs changed. Review all supplied terms.');
}
