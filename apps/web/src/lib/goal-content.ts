// Content for the savings-goal panels on the home page.
//
// PLACEHOLDER. Every figure and member quote here is SAMPLE CONTENT for the marketing site and
// is labelled "Sample content" on the page while GOAL_CONTENT_IS_SAMPLE is true. Replace the
// entries with real records and real, permitted member feedback, then set the flag to false so
// the label disappears. Nothing here is a return, a rate or a promise: the "ahead" lines are
// scheduled targets only.

export const GOAL_CONTENT_IS_SAMPLE = true;

/** A goal's short code, for example "asset". Admins can add more, so any short code is valid. */
export type GoalKey = string;

export type GoalContent = {
  key: GoalKey;
  label: string;
  purpose: string;
  /** Icon code, see lib/goal-style.ts. */
  icon: string;
  /** Colour code, see lib/goal-style.ts. */
  accent: string;
  about: string;
  how: string[];
  past: string[];
  present: string[];
  ahead: string[];
  quotes: { text: string; who: string }[];
};

export const GOAL_CONTENT: GoalContent[] = [
  {
    key: "asset",
    icon: "building",
    accent: "gold",
    label: "Asset",
    purpose: "Save towards an asset or a significant purchase.",
    about:
      "For the big things worth planning for: a stand, a vehicle, equipment for your business or a deposit on a home.",
    how: [
      "Choose an Asset plan and a weekly amount that suits you.",
      "Your contributions are recorded in your history every week.",
      "You keep going until you reach the amount you set out to save.",
    ],
    past: [
      "412 members chose Asset savings in the last 12 months.",
      "86 members reached their Asset goal.",
    ],
    present: [
      "318 members are saving towards an Asset goal this month.",
      "24 new Asset savers joined in November.",
    ],
    ahead: [
      "Target: 450 active Asset savers by March.",
      "Target: an Asset savers' information evening in the first quarter.",
    ],
    quotes: [
      {
        text: "Having a plan with a clear weekly amount made a big purchase feel possible.",
        who: "Sample member, Bulawayo",
      },
      {
        text: "I could see every contribution in my history, so I always knew where I stood.",
        who: "Sample member, Harare",
      },
    ],
  },
  {
    key: "holiday",
    icon: "plane",
    accent: "blue",
    label: "Holiday",
    purpose: "Save towards a future holiday or travel goal.",
    about:
      "Put a little aside each week so a family trip or a long-awaited break is paid for before you leave.",
    how: [
      "Pick a Holiday plan and decide when you want to travel.",
      "Save week by week, with each payment recorded.",
      "Travel with your savings already in place.",
    ],
    past: [
      "318 members chose Holiday savings in the last 12 months.",
      "112 members completed their Holiday goal.",
    ],
    present: [
      "241 members are saving towards a Holiday this month.",
      "A December travel savers' meet-up is being arranged.",
    ],
    ahead: [
      "Target: 300 active Holiday savers by March.",
      "Target: a members' travel-tips event in the second quarter.",
    ],
    quotes: [
      {
        text: "We booked our trip knowing the money was already there.",
        who: "Sample member, Gweru",
      },
      {
        text: "Saving a small amount each week was easier than I expected.",
        who: "Sample member, Bulawayo",
      },
    ],
  },
  {
    key: "emergency",
    icon: "shield",
    accent: "red",
    label: "Emergency",
    purpose: "Set money aside for unexpected needs.",
    about:
      "A cushion for the things nobody plans for, such as a repair, a medical bill or a sudden family need.",
    how: [
      "Choose an Emergency plan with a weekly amount you can keep up.",
      "Build the cushion steadily, one contribution at a time.",
      "Know you have something set aside when life surprises you.",
    ],
    past: [
      "506 members chose Emergency savings in the last 12 months.",
      "143 members reached their cushion target.",
    ],
    present: [
      "389 members are building an Emergency cushion this month.",
      "31 new Emergency savers joined in November.",
    ],
    ahead: [
      "Target: 550 active Emergency savers by March.",
      "Target: a short member guide on building a cushion.",
    ],
    quotes: [
      {
        text: "It is a relief to have something set aside before I need it.",
        who: "Sample member, Mutare",
      },
      {
        text: "I started small and the cushion grew faster than I thought.",
        who: "Sample member, Bulawayo",
      },
    ],
  },
  {
    key: "retrenchment",
    icon: "briefcase",
    accent: "purple",
    label: "Retrenchment",
    purpose: "Prepare a savings cushion for a possible loss of employment.",
    about:
      "A buffer to give you breathing room if work changes, so you can look for the next step without panic.",
    how: [
      "Choose a Retrenchment plan and a weekly amount.",
      "Keep contributing while you are working.",
      "Have a cushion ready if your income is interrupted.",
    ],
    past: [
      "187 members chose Retrenchment savings in the last 12 months.",
      "41 members reached their cushion target.",
    ],
    present: [
      "152 members are saving towards a Retrenchment cushion this month.",
      "9 new Retrenchment savers joined in November.",
    ],
    ahead: [
      "Target: 220 active Retrenchment savers by March.",
      "Target: a members' workshop on planning for work changes.",
    ],
    quotes: [
      {
        text: "Knowing I have a buffer lets me plan with a clearer head.",
        who: "Sample member, Kwekwe",
      },
      {
        text: "It is the plan I hope never to use, and I am glad it is there.",
        who: "Sample member, Bulawayo",
      },
    ],
  },
  {
    key: "education",
    icon: "graduation",
    accent: "green",
    label: "Education",
    purpose: "Save towards future education costs.",
    about:
      "Get ahead of school, college or training costs by saving a little every week instead of facing one big bill.",
    how: [
      "Choose an Education plan and set your weekly amount.",
      "Save before the next term or intake begins.",
      "Pay for learning from money you set aside in advance.",
    ],
    past: [
      "341 members chose Education savings in the last 12 months.",
      "97 members completed their Education goal.",
    ],
    present: [
      "276 members are saving towards Education this month.",
      "27 new Education savers joined in November.",
    ],
    ahead: [
      "Target: 150 new Education savers by March.",
      "Target: a back-to-school savings drive in January.",
    ],
    quotes: [
      {
        text: "School fees no longer arrive as a shock. We save for them all year.",
        who: "Sample member, Harare",
      },
      {
        text: "I enrolled for my course with the money already saved.",
        who: "Sample member, Bulawayo",
      },
    ],
  },
];

export function findGoal(key: string): GoalContent | undefined {
  return GOAL_CONTENT.find((g) => g.key === key);
}
