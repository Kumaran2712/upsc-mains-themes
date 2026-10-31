# G[key] = (what UPSC asks, [prep checklist], [answer-writing pointers])
G = {}
G["harappan"] = ("UPSC asks about Harappan architecture and town planning, and pushes you to connect it to today: lessons for modern urbanisation, and why Indian civilisation survived without a break unlike Egypt or Mesopotamia. Geography's role in shaping ancient India also comes up.",
 ["Harappan town planning: grid layout, drainage, citadel vs lower town, granaries, Great Bath, burnt bricks", "Lessons for present cities: drainage, water harvesting (Dholavira), zoning", "Continuity of Indian civilisation: language, religion, crafts, agriculture practices that survived", "Comparison points with Egypt, Mesopotamia, Greece", "Geography of ancient India: rivers, monsoon, Himalayan barrier, passes, coastline"],
 ["Use one or two named sites (Dholavira, Lothal, Mohenjo-daro) as evidence in every answer", "For 'present-day relevance' questions, split the body into then vs now and end with a takeaway for smart cities"])
G["vedic"] = ("Questions trace change from Rig Vedic to Later Vedic society and economy, and ask which Vedic features still live on in Indian society.",
 ["Rig Vedic vs Later Vedic: pastoral to agrarian, tribe to territorial state, varna hardening, position of women", "Vedic religion: nature gods, yajna, rise of ritualism and Upanishadic reaction", "Surviving features: rituals, varna/caste, gotra, sanskaras, family structure"],
 ["A two-column comparison (Rig vs Later Vedic) works well in 150 words", "For 'still prevailing' questions, give the feature, then a present example, then how it has changed"])
G["sources"] = ("UPSC asks how specific sources help reconstruct history: Ashokan inscriptions, rock-cut caves, Chinese and Arab travellers, Persian texts, Sangam literature. The angle is always 'what does this source tell us, and what are its limits'.",
 ["Ashokan edicts: dhamma, administration, extent of empire, script (Brahmi, Kharosthi)", "Rock-cut caves: Barabar, Ajanta, Ellora, Elephanta and what they reveal on art, religion, patronage", "Travellers: Megasthenes, Fa-Hien, Hiuen Tsang, Al-Biruni, Ibn Battuta", "Persian sources: Ain-i-Akbari, Baburnama, court chronicles", "Sangam literature: social and economic life vs weak political chronology"],
 ["Structure: what the source is → what it reveals (polity, economy, society, religion) → its limitations or biases", "Name at least three specific examples per answer"])
G["buddhistart"] = ("Questions focus on how Buddhist art expressed ideas: stupa reliefs using folk motifs, Gandhara's Greek and Roman influences, and the Pala period's importance for Buddhism.",
 ["Stupa art: Sanchi, Bharhut, Amaravati, jataka narratives, aniconic phase", "Gandhara vs Mathura vs Amaravati schools: material, features, influences", "Pala period: Nalanda, Vikramashila, Vajrayana, art and spread to Tibet and South-East Asia"],
 ["Compare schools in a short table if the question allows", "Always link the art feature to the Buddhist idea it carries"])
G["temple"] = ("The most repeated culture area. UPSC asks about specific dynasties (Pallava, Chola, Chandela, Vijayanagara, Gupta) and their contribution to art and architecture, and how philosophy shaped monuments.",
 ["Nagara, Dravida and Vesara styles: key features and examples", "Pallavas: Mamallapuram rathas, Shore Temple, Kailasanatha; also literature", "Cholas: Brihadeeswara, Gangaikondacholapuram, bronzes (Nataraja), administration", "Chandelas: Khajuraho, sculpture's vigour", "Vijayanagara: Hampi, blending older Dravida tradition with new features", "Gupta contributions: temples, sculpture, literature, science", "How Indian philosophy (cosmology, iconography, vastu) shaped monuments"],
 ["Open with the dynasty's period and region, then architecture, sculpture, literature/other arts", "Name temples and specific features — examiners reward precise examples", "Quote-based questions ('…still remembered with pride') need you to justify the quote with evidence"])
G["sculpture"] = ("Questions ask what sculpture and painting reveal (temple sculpture as a record of social life, Mesolithic rock art), the meaning of motifs (lion and bull), Gupta coins, and the need to safeguard art heritage.",
 ["Medieval temple sculpture as social record: dance, music, war, daily life", "Lion and bull motifs: Harappan seals, Mauryan capitals, mythology", "Mesolithic rock art: Bhimbetka, themes, technique", "Gupta numismatics: gold coins, themes, decline later", "Heritage protection: ASI, laws, illegal trade, repatriation, UNESCO"],
 ["Use 'evidence → interpretation' format", "For heritage protection, end with concrete measures (digitisation, community role, laws)"])
G["bhakti"] = ("UPSC asks about the nature and contribution of Bhakti literature, Chaitanya's role, whether Sufis and saints really changed society, and Akbar's syncretism.",
 ["Bhakti: Alvars and Nayanars, Kabir, Nanak, Mirabai, Chaitanya; saguna vs nirguna", "Contribution: regional languages, social equality message, music", "Sufism: silsilas (Chishti, Suhrawardi), khanqah, interaction with bhakti", "Limits: caste and religious structures largely remained", "Akbar: sulh-i-kul, Ibadat Khana, Din-i-Ilahi, translation bureau"],
 ["For 'failed to modify' type statements, give both sides: changes in ideas and language vs continuity in structures", "Link to Indian secularism where relevant"])
G["patronage"] = ("Questions ask about royal patronage of learning (Krishnadeva Raya), ancient universities (Taxila vs Nalanda), and technology introduced in the Sultanate period.",
 ["Krishnadeva Raya: Amuktamalyada, Ashtadiggajas, Telugu and Sanskrit literature", "Taxila vs Nalanda: subjects, scholars, why Nalanda fits the 'university' idea", "Sultanate technology: paper, spinning wheel, arch and dome, Persian wheel, and their social effects"],
 ["Link each technology to the social change it caused", "For Taxila, explain why it was a centre of learning rather than an organised university"])

G["brexpansion"] = ("UPSC asks why the East India Company won against larger Indian armies, how 18th-century India was politically fragmented, why Panipat saw repeated battles, and Dalhousie's role.",
 ["Decline of Mughals and rise of regional states", "Plassey, Buxar, Anglo-Mysore, Anglo-Maratha, Anglo-Sikh wars", "Reasons for British success: discipline, finance, diplomacy, divisions among rulers", "Panipat: geography and strategic location", "Dalhousie: doctrine of lapse, railways, telegraph, postal reforms"],
 ["Group reasons into military, economic, political and organisational", "Use specific battles as evidence"])
G["coloneco"] = ("Questions repeat on how British policies hurt India's economy: decline of handicrafts, collapse of the rural artisan economy, famines, and an overall critical assessment of British economic policy.",
 ["Drain of wealth (Naoroji), land revenue systems (Permanent, Ryotwari, Mahalwari)", "Deindustrialisation: competition from British machine goods, loss of royal patronage", "Famines: commercialisation of agriculture, revenue demands, policy failures", "Railways and commercialisation: who gained, who lost"],
 ["Structure by phases (mercantile, free trade, finance capital) for 'mid-18th century till independence' questions", "Always link back to the rural economy and peasants"])
G["colonadmin"] = ("UPSC asks about policies that shaped administration and education (Macaulay's Minute) and Curzon's policies and their effect on the national movement.",
 ["Macaulay's Minute 1835: English education, 'downward filtration', effects on administration and nationalism", "Curzon: partition of Bengal, universities act, Calcutta corporation, effect on Swadeshi"],
 ["Show both intended effects and unintended effects (e.g. English education creating nationalists)"])
G["revolt"] = ("Questions ask how 1857 changed British policy and how colonial rule affected tribals and how they resisted.",
 ["1857: causes, spread, nature, consequences, Queen's Proclamation, army reorganisation, policy towards princes", "Colonial impact on tribals: forest laws, land alienation, moneylenders, missionaries", "Tribal revolts: Santhal, Munda (Birsa), Bhil, Rampa"],
 ["Name specific movements and leaders", "Tribal questions benefit from a link to present-day tribal policy and forest rights"])
G["reform"] = ("UPSC asks about the rise of reform movements (Brahmo Samaj, Young Bengal) and reformers like Phule who addressed subaltern groups.",
 ["Brahmo Samaj, Young Bengal, Prarthana Samaj, Arya Samaj, Ramakrishna Mission", "Phule: Satyashodhak Samaj, Gulamgiri, education for women and lower castes", "Caste reformers: Narayana Guru, Periyar, Ambedkar"],
 ["Organise by region or by issue (caste, women, religion)", "Link reformers' ideas to constitutional values today"])
G["earlynat"] = ("Questions assess the Moderates: did they lay the base for the freedom movement, and why did they fail to convince the nation? Foreigners' contribution also appears.",
 ["Moderates: petitions, economic critique of British rule, drain theory, building public opinion", "Limitations: narrow social base, faith in British justice", "Foreigners: Annie Besant, Sister Nivedita, A.O. Hume, C.F. Andrews, Madeleine Slade"],
 ["Balance achievements and limitations", "Use names and specific contributions"])
G["gandhi"] = ("Gandhi is UPSC's favourite personality: mass mobilisation, constructive programmes, his relevance today, comparison with Tagore, Ambedkar and Bose, and whether independence would differ without him.",
 ["Gandhian movements: Champaran, Kheda, Ahmedabad, Non-Cooperation, Civil Disobedience, Quit India — who was mobilised", "Constructive programme: khadi, Hindu-Muslim unity, untouchability removal, basic education", "Gandhi vs Tagore (education, nationalism), vs Ambedkar (caste, strategy), vs Bose (methods)", "Relevance today: non-violence, sustainable living, decentralisation, conflict resolution"],
 ["For comparisons, a clear 'common goal, different method' frame scores well", "For 'relevance today', link each Gandhian idea to a current issue"])
G["ideologies"] = ("Questions ask how the national movement widened its social base through new ideological strands in the 1920s (socialism, communism, peasant and worker movements), the new goals added (economic and social freedom), and world developments that motivated anti-colonial struggle.",
 ["Left wing: Nehru, Bose, CSP, communists, trade unions, Kisan Sabha", "Purna Swaraj and the economic programme (Karachi resolution)", "Global influences: Russian Revolution, World Wars, Irish and other anti-colonial movements"],
 ["Link each strand to the social group it brought in"])
G["finalphase"] = ("UPSC asks about events leading to Quit India and its results, the naval mutiny's significance, and Maulana Azad's contributions.",
 ["Quit India: Cripps failure, war context, leaderless phase, parallel governments", "RIN mutiny 1946 and why it signalled the end of British rule", "Maulana Azad: Khilafat, Congress president, education minister, composite nationalism"],
 ["Cause → course → consequence structure"])
G["making"] = ("Questions ask how the Government of India Act 1935 helped the Constituent Assembly, and whether that Act laid down a federal constitution.",
 ["GoI Act 1935: federation, provincial autonomy, dyarchy at centre, federal court, lists", "Borrowings into the Constitution", "Constituent Assembly working and timeline"],
 ["Show specific provisions carried over", "Link to Indian federalism's 'strong Centre' character"])
G["statesreorg"] = ("A strong cross-paper theme. GS1 asks about princely state integration and linguistic reorganisation; GS2 asks whether smaller states mean better governance. Recent questions ask whether reorganisation came from popular pressure from below.",
 ["Integration of princely states: Patel, V.P. Menon, Junagadh, Hyderabad, Kashmir", "Linguistic reorganisation: Potti Sriramulu, SRC 1953–56, effect on unity", "New states: Uttarakhand, Jharkhand, Chhattisgarh, Telangana — economic results", "Arguments for and against smaller states", "Continuous reorganisation since the 19th century"],
 ["Use both history and present governance evidence", "End with a balanced view on unity and administrative efficiency"])
G["consolidation"] = ("UPSC asks you to trace consolidation in the early years across polity, economy, education and foreign policy, and the meaning of slogans like 'Jai Jawan Jai Kisan'.",
 ["Constitution-making, first elections, planning, industrial policy, IITs and education, NAM", "1965 war, food crisis, Green Revolution push"],
 ["Use a dimension-wise structure (polity, economy, education, external)"])
G["earlyfp"] = ("Questions ask about the Tashkent Agreement, India's role in creating Bangladesh, and the Gujral doctrine's relevance today.",
 ["1965 war and Tashkent highlights", "1971: refugee crisis, security, Indo-Soviet treaty, outcome", "Gujral doctrine principles and their echo in Neighbourhood First"],
 ["Link historical choices to present neighbourhood policy"])

G["revolutions"] = ("Questions ask about the American Revolution as an economic revolt against mercantilism and the French Revolution's continuing relevance.",
 ["American Revolution: mercantilism, taxation, ideas of liberty, results", "French Revolution: liberty, equality, fraternity, rights, nationalism, democracy"],
 ["For 'relevance today', match each revolutionary idea with a present institution or debate"])
G["industrialrev"] = ("UPSC asks why the Industrial Revolution began in England, life of workers then vs India today, Japan's 'latecomer' path, and the effects of railways worldwide.",
 ["Reasons for England's lead: capital, colonies, coal and iron, agricultural revolution, inventions", "Social effects: urban slums, child labour, labour laws", "Japan's state-led model after Meiji", "Railways' socio-economic effects in different countries"],
 ["Comparisons work best as point-by-point contrasts"])
G["worldwars"] = ("Questions ask whether WWI was about balance of power, Germany's responsibility for both wars, the threat to democracy between the wars, and policy responses to the Great Depression.",
 ["WWI causes: alliances, imperialism, nationalism, balance of power", "Interwar: Versailles, rise of fascism and Nazism, failure of League", "Great Depression: New Deal, Keynesian policies, protectionism", "WWII causes"],
 ["Give a balanced verdict on 'how far' questions"])
G["decolon"] = ("UPSC asks about decolonisation struggles in Africa and Malaya, the Suez crisis, and artificial African borders.",
 ["Scramble for Africa and Berlin Conference", "Western-educated African elites leading anti-colonial movements", "Malaya: ethnic composition, communist insurgency", "Suez 1956 and end of British power"],
 ["Use specific countries and leaders as examples"])
