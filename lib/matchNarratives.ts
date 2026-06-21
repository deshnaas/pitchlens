// PitchLens — Match Narratives
// Pre-authored story text and curated key moments for each match.
// These are the chapters the user explores — not raw event data.

import type { KeyMoment } from "@/components/incident/MatchStoryScreen";

export type MatchNarrative = {
  narrative: string;         // the match story (shown in left panel)
  moments: KeyMoment[];      // curated chapters (shown as large cards)
};

export const MATCH_NARRATIVES: Record<string, MatchNarrative> = {

  // ─── JAPAN vs SPAIN ─────────────────────────────────────────────
  "japan-spain": {
    narrative: `Spain controlled the first half. Morata's goal in the 11th minute felt inevitable — Japan were overwhelmed, unable to escape their own half for sustained periods.

Then halftime arrived. Japan's coach Moriyasu made two quiet substitutions: Doan and Mitoma replaced Kubo and Nagatomo. What looked like tactical adjustment became the hinge of the entire match.

Within two minutes of the restart, Doan had equalized. Three minutes after that, Tanaka had scored. Spain — the group favourites — had been overturned in a spell of football that lasted less than five minutes.

The goal that completed Japan's comeback became one of the most discussed VAR decisions of the tournament. Ball-in, ball-out. The footage was inconclusive. The goal stood.`,

    moments: [
      {
        id: "js-goal-11",
        minute: 11,
        type: "goal",
        team: "Spain",
        icon: "⚽",
        title: "Morata Opens Scoring",
        context: "Spain have dominated from the first whistle. Morata converts after Japan fail to clear. The goal looks like confirmation of what everyone expected.",
      },
      {
        id: "js-sub-45",
        minute: 45,
        type: "substitution",
        team: "Japan",
        icon: "🔄",
        title: "Japan's Halftime Transformation",
        context: "Doan and Mitoma come on for Kubo and Nagatomo. A tactical shift from Moriyasu that will change the match completely.",
      },
      {
        id: "js-goal-47",
        minute: 47,
        type: "goal",
        team: "Japan",
        icon: "⚽",
        title: "Doan Equalizes",
        context: "Two minutes after halftime. Mitoma's pressure forces an error. Doan fires low and hard. Japan have levelled immediately. Spain are stunned.",
      },
      {
        id: "js-goal-50",
        minute: 50,
        type: "goal",
        team: "Japan",
        icon: "⚽",
        title: "Tanaka Completes the Comeback",
        context: "The goal-line moment that defined the tournament. Mitoma crosses. Tanaka converts. The ball may or may not have crossed the line. VAR says yes. Japan lead.",
      },
      {
        id: "js-sub-56",
        minute: 56,
        type: "substitution",
        team: "Spain",
        icon: "🔄",
        title: "Spain Bring On Fresh Legs",
        context: "Luis Enrique reacts — Morata and Williams off, Asensio and Ferrán Torres on. Spain press for an equalizer that never comes.",
      },
    ],
  },

  // ─── GERMANY vs JAPAN ───────────────────────────────────────────
  "germany-japan": {
    narrative: `Germany were expected to win. Everything pointed that way — rankings, history, squad depth. Gündoğan's penalty in the 32nd minute confirmed the narrative.

Japan changed at halftime. Not their formation on paper — but the players. Mitoma and Asano came on at the 56th minute. Two of Japan's most explosive forwards. Two players who had been sitting, watching, waiting.

Germany's high defensive line — the same system that had worked for 70 minutes — became a vulnerability. Mitoma attacked the left channel. Space appeared. Doan arrived late to equalize.

Eight minutes later, Asano received the ball on the right byline with only Schlotterbeck between him and goal. The angle was near-impossible. He shot anyway. The ball squeezed past Neuer. Germany were eliminated.`,

    moments: [
      {
        id: "gj-goal-32",
        minute: 32,
        type: "goal",
        team: "Germany",
        icon: "⚽",
        title: "Gündoğan Penalty",
        context: "Germany earn a penalty after Havertz is brought down in the box. Gündoğan steps up and sends Gonda the wrong way. The expected script is playing out.",
      },
      {
        id: "gj-sub-56",
        minute: 56,
        type: "substitution",
        team: "Japan",
        icon: "🔄",
        title: "Mitoma and Asano Introduced",
        context: "Japan's coach sends on two of his most dangerous forwards. The substitution reshapes Japan's attacking threat and exposes Germany's defensive line.",
      },
      {
        id: "gj-goal-74",
        minute: 74,
        type: "goal",
        team: "Japan",
        icon: "⚽",
        title: "Doan Equalizes",
        context: "Mitoma creates chaos on the left. Doan arrives at the far post and fires low past Neuer. Germany's lead — held for 42 minutes — is gone.",
      },
      {
        id: "gj-goal-82",
        minute: 82,
        type: "goal",
        team: "Japan",
        icon: "⚽",
        title: "Asano's Impossible Finish",
        context: "Racing Schlotterbeck to the byline on the right, Asano reaches an angle that should make shooting impossible. He shoots anyway. It goes in. Germany are eliminated.",
      },
    ],
  },

  // ─── IRAN vs USA ────────────────────────────────────────────────
  "iran-usa": {
    narrative: `Two nations with a complicated history. A match that meant elimination for the loser. The politics of it hung over everything — the protests in Iran, the controversy surrounding the national anthem, the extraordinary noise from both sets of supporters.

Christian Pulisic scored in the 37th minute, diving to meet a cross and taking a fierce collision from the Iranian goalkeeper. He scored. He immediately went down. He was stretchered off. He watched the rest of the match from hospital.

For 53 minutes, the United States defended their lead against Iran's desperate pressure. The wall held. Pulisic's teammates qualified for the round of 16 while their captain lay in a hospital bed.`,

    moments: [
      {
        id: "iu-goal-37",
        minute: 37,
        type: "goal",
        team: "United States",
        icon: "⚽",
        title: "Pulisic Scores — And Falls",
        context: "Pulisic throws himself at the cross and scores. The collision with the keeper is immediate and fierce. He lies motionless. He is stretchered off.",
      },
      {
        id: "iu-sub-45",
        minute: 45,
        type: "substitution",
        team: "United States",
        icon: "🔄",
        title: "Aaronson Replaces Pulisic",
        context: "Pulisic cannot continue. Aaronson comes on. The team must now hold a 1-0 lead without their captain and best player.",
      },
      {
        id: "iu-card-82",
        minute: 82,
        type: "card",
        team: "Iran",
        icon: "🟨",
        title: "Yellow Card — Kanani Zadegan",
        context: "Iran's frustration shows. A yellow card as they chase an equaliser that will not come. The USA hold on.",
      },
    ],
  },

  // ─── ENGLAND vs WALES ───────────────────────────────────────────
  "england-wales": {
    narrative: `Wales had a plan: defend deep, give Bale every chance to contribute, stay in the match until the final whistle. It worked for 45 minutes. Then Bale was substituted at halftime with a muscle concern.

What happened next was swift and merciless. Rashford scored a free kick four minutes into the second half. Phil Foden added a second 90 seconds later. Wales had conceded twice before they could reorganise.

Rashford scored again in the 67th minute with a composed finish. The derby was over. Three goals in 18 minutes. Wales's World Cup was finished.`,

    moments: [
      {
        id: "ew-sub-45",
        minute: 45,
        type: "substitution",
        team: "Wales",
        icon: "🔄",
        title: "Bale Withdrawn at Halftime",
        context: "Wales lose their captain and talisman before the second half begins. It proves to be the defining moment of the match.",
      },
      {
        id: "ew-goal-49",
        minute: 49,
        type: "goal",
        team: "England",
        icon: "⚽",
        title: "Rashford Free Kick",
        context: "Four minutes into the second half. Rashford steps up from 25 yards and bends the ball into the top corner over the Welsh wall. 1–0.",
      },
      {
        id: "ew-goal-50",
        minute: 50,
        type: "goal",
        team: "England",
        icon: "⚽",
        title: "Foden Makes It Two",
        context: "Ninety seconds later. Foden threads a precise finish through a crowd of Welsh defenders. Wales are broken. 2–0.",
      },
      {
        id: "ew-goal-67",
        minute: 67,
        type: "goal",
        team: "England",
        icon: "⚽",
        title: "Rashford's Second Seals It",
        context: "Rashford turns provider into finisher again. Wales have no answer. England qualify for the Round of 16 comfortably. Wales are out.",
      },
    ],
  },

  // ─── GHANA vs PORTUGAL ──────────────────────────────────────────
  "ghana-portugal": {
    narrative: `Five goals in a match that changed direction four times. Portugal scored through a Ronaldo penalty — he became the first player to score at five World Cups. Ghana equalized through Ayew.

Then Portugal's substitutes took over. Joao Felix and Rafael Leao — two of Europe's most exciting attacking talents — both scored. Portugal led 3-1 and appeared to be coasting.

Ghana refused. Osman Bukari scored with two minutes remaining, making it 3-2. For those final minutes, Ghana pushed desperately for an equaliser that didn't arrive. A match of extraordinary individual brilliance and extraordinary stubbornness.`,

    moments: [
      {
        id: "gp-goal-64",
        minute: 64,
        type: "goal",
        team: "Portugal",
        icon: "⚽",
        title: "Ronaldo Penalty — History Made",
        context: "Ronaldo converts from the spot to become the first player to score at five World Cups. He celebrates like it is the greatest goal ever scored.",
      },
      {
        id: "gp-goal-72",
        minute: 72,
        type: "goal",
        team: "Ghana",
        icon: "⚽",
        title: "Ayew Equalizes",
        context: "Ghana reply immediately. Ayew ghosts in unmarked and levels. The match is suddenly alive again.",
      },
      {
        id: "gp-sub-76",
        minute: 76,
        type: "substitution",
        team: "Portugal",
        icon: "🔄",
        title: "Leão Introduced",
        context: "Rafael Leão comes on. Within three minutes he has scored. Portugal's bench talent changes the match.",
      },
      {
        id: "gp-goal-77",
        minute: 77,
        type: "goal",
        team: "Portugal",
        icon: "⚽",
        title: "Joao Felix Makes It 3–1",
        context: "A composed finish from the Atlético Madrid forward. Portugal are in control — or so it seems.",
      },
      {
        id: "gp-goal-79",
        minute: 79,
        type: "goal",
        team: "Portugal",
        icon: "⚽",
        title: "Leão Scores Immediately",
        context: "Leão caps his impact as a substitute. Two goals in ten minutes from Portugal's bench. Ghana need three now.",
      },
      {
        id: "gp-goal-88",
        minute: 88,
        type: "goal",
        team: "Ghana",
        icon: "⚽",
        title: "Bukari Pulls One Back",
        context: "Ghana refuse to die. Bukari scores with two minutes left. 3-2. A frantic finish — but Portugal hold on.",
      },
    ],
  },

  // ─── BELGIUM vs CROATIA ─────────────────────────────────────────
  "belgium-croatia": {
    narrative: `Belgium's golden generation needed a win. Lukaku — their greatest ever striker — was on the bench, returning from injury. Croatia needed only a draw to progress.

The match had opportunities. Belgium pressed. Croatia defended. Lukaku was introduced and had two goals disallowed — one for offside, one for handball. Each denial felt like a verdict.

The final whistle confirmed it. Belgium 0–0 Croatia. The generation of De Bruyne, Hazard, Lukaku and Witsel ended not with a trophy, but a draw that sent them home. Croatia progressed in their place.`,

    moments: [
      {
        id: "bc-sub-45",
        minute: 45,
        type: "substitution",
        team: "Belgium",
        icon: "🔄",
        title: "Lukaku Introduced at Halftime",
        context: "Belgium's record goalscorer comes on at halftime, returning from injury. The hope is that his presence alone will change the match.",
      },
      {
        id: "bc-card-82",
        minute: 82,
        type: "card",
        team: "Iran",
        icon: "🟨",
        title: "Yellow Card — Kanani Zadegan",
        context: "Frustration builds. The yellow card is a symptom of a match that has resisted all pressure for a decisive moment.",
      },
      {
        id: "bc-sub-86",
        minute: 86,
        type: "substitution",
        team: "Belgium",
        icon: "🔄",
        title: "Eden Hazard's Final Appearance",
        context: "Hazard comes on with four minutes left. It is, in effect, his final act in international football. He cannot change the scoreline.",
      },
    ],
  },
};
