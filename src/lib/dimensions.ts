/**
 * Sub-dimension metadata registry.
 *
 * Two tiers:
 *   category   — the 7–11 computed scores stored on game_scores (cognitiveScore, dopamineRisk, etc.)
 *   individual — the 44 raw assessor inputs stored on reviews (problemSolving, variableRewards, etc.)
 *
 * keys match DB column names exactly so any UI component can look up metadata
 * for a value it received from the API without a separate mapping step.
 */

export type DimensionCategory =
  | 'B1' | 'B2' | 'B3'
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'
  | 'REP' | 'PROP'

export type DimensionLevel = 'category' | 'individual'
export type DimensionType  = 'benefit' | 'risk' | 'display'

export type Dimension = {
  key: string
  display_name: string
  short_description: string
  category: DimensionCategory
  level: DimensionLevel
  type: DimensionType
  /** Raw score ceiling for individual dimensions (5 for benefits, 3 for risks). Null for category-level normalized scores. */
  max_raw_score: number | null
  /** Whether this dimension feeds into RIS or BDS (false = display-only). */
  feeds_into_score: boolean
  methodology_anchor: string
}

export const DIMENSIONS: Dimension[] = [

  // ── Category: B1 Cognitive Development ─────────────────────────────────────
  {
    key:                'cognitiveScore',
    display_name:       'Cognitive Development',
    short_description:  'How strongly the game develops problem solving, spatial reasoning, memory, creativity, and learning skills.',
    category:           'B1',
    level:              'category',
    type:               'benefit',
    max_raw_score:      null,
    feeds_into_score:   true,
    methodology_anchor: '#b1-cognitive-development',
  },

  // ── Category: B2 Social & Emotional Development ─────────────────────────────
  {
    key:                'socialEmotionalScore',
    display_name:       'Social & Emotional Development',
    short_description:  'How strongly the game builds teamwork, empathy, emotional regulation, and ethical reasoning.',
    category:           'B2',
    level:              'category',
    type:               'benefit',
    max_raw_score:      null,
    feeds_into_score:   true,
    methodology_anchor: '#b2-social-emotional-development',
  },

  // ── Category: B3 Physical & Motor Development ───────────────────────────────
  {
    key:                'motorScore',
    display_name:       'Physical & Motor Development',
    short_description:  'How strongly the game trains hand-eye coordination, fine motor skills, reaction time, and physical movement.',
    category:           'B3',
    level:              'category',
    type:               'benefit',
    max_raw_score:      null,
    feeds_into_score:   true,
    methodology_anchor: '#b3-physical-motor-development',
  },

  // ── Category: R1 Dopamine Manipulation ─────────────────────────────────────
  {
    key:                'dopamineRisk',
    display_name:       'Dopamine Manipulation',
    short_description:  'How heavily the game uses variable rewards, streaks, FOMO, and other compulsion loops to drive engagement.',
    category:           'R1',
    level:              'category',
    type:               'risk',
    max_raw_score:      null,
    feeds_into_score:   true,
    methodology_anchor: '#r1-dopamine-manipulation',
  },

  // ── Category: R2 Monetisation Pressure ─────────────────────────────────────
  {
    key:                'monetizationRisk',
    display_name:       'Monetisation Pressure',
    short_description:  'How aggressively the game encourages spending through pay-to-win, currency obfuscation, ads, and targeted prompts.',
    category:           'R2',
    level:              'category',
    type:               'risk',
    max_raw_score:      null,
    feeds_into_score:   true,
    methodology_anchor: '#r2-monetisation-pressure',
  },

  // ── Category: R3 Social & Emotional Risk ───────────────────────────────────
  {
    key:                'socialRisk',
    display_name:       'Social & Emotional Risk',
    short_description:  'The level of social obligation, competitive toxicity, stranger interaction risk, and identity pressure in the game.',
    category:           'R3',
    level:              'category',
    type:               'risk',
    max_raw_score:      null,
    feeds_into_score:   true,
    methodology_anchor: '#r3-social-emotional-risk',
  },

  // ── Category: R4 Content Risk (display only) ───────────────────────────────
  {
    key:                'contentRisk',
    display_name:       'Content Risk',
    short_description:  'Age-appropriateness of violence, sexual content, language, substance references, and frightening imagery. Does not affect the time recommendation.',
    category:           'R4',
    level:              'category',
    type:               'display',
    max_raw_score:      null,
    feeds_into_score:   false,
    methodology_anchor: '#r4-content-risk',
  },

  // ── Category: R5 Accessibility Risk (display only) ─────────────────────────
  {
    key:                'accessibilityRisk',
    display_name:       'Accessibility Barriers',
    short_description:  'How difficult it is to access the game across platforms, load times, mobile support, and login requirements.',
    category:           'R5',
    level:              'category',
    type:               'display',
    max_raw_score:      null,
    feeds_into_score:   false,
    methodology_anchor: '#r5-accessibility',
  },

  // ── Category: R6 Endless Design Risk (display only) ────────────────────────
  {
    key:                'endlessDesignRisk',
    display_name:       'Endless Design',
    short_description:  'Whether the game is designed to run indefinitely with no natural stopping points, game-overs, or chapter breaks.',
    category:           'R6',
    level:              'category',
    type:               'display',
    max_raw_score:      null,
    feeds_into_score:   false,
    methodology_anchor: '#r6-endless-design',
  },

  // ── Category: REP Representation (display only) ────────────────────────────
  {
    key:                'representationScore',
    display_name:       'Representation',
    short_description:  'How authentically the game represents gender and ethnic diversity in its characters and world.',
    category:           'REP',
    level:              'category',
    type:               'display',
    max_raw_score:      null,
    feeds_into_score:   false,
    methodology_anchor: '#rep-representation',
  },

  // ── Category: PROP Propaganda Level (display only) ─────────────────────────
  {
    key:                'propagandaLevel',
    display_name:       'Ideological Content',
    short_description:  'Whether the game contains notable political, nationalist, or religious framing. 0 = neutral, 3 = heavy propaganda.',
    category:           'PROP',
    level:              'category',
    type:               'display',
    max_raw_score:      null,
    feeds_into_score:   false,
    methodology_anchor: '#prop-propaganda',
  },

  // ── B1 Individual dimensions ────────────────────────────────────────────────
  {
    key: 'problemSolving', display_name: 'Problem Solving',
    short_description:  'Novel problems requiring reasoning, experimentation, or logic with non-obvious solutions.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b11-problem-solving',
  },
  {
    key: 'spatialAwareness', display_name: 'Spatial Awareness',
    short_description:  'Mental rotation, 3D navigation, map reading, or spatial planning.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b12-spatial-awareness',
  },
  {
    key: 'strategicThinking', display_name: 'Strategic Thinking',
    short_description:  'Planning ahead, resource management, and evaluating trade-offs.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b13-strategic-thinking',
  },
  {
    key: 'criticalThinking', display_name: 'Critical Thinking',
    short_description:  'Evaluating information, questioning assumptions, or making evidence-based decisions.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b14-critical-thinking',
  },
  {
    key: 'memoryAttention', display_name: 'Memory & Attention',
    short_description:  'Working memory, sustained attention, or pattern recognition.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b15-memory-attention',
  },
  {
    key: 'creativity', display_name: 'Creativity & Expression',
    short_description:  'Open-ended tools for building, designing, composing, or storytelling.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b16-creativity',
  },
  {
    key: 'readingLanguage', display_name: 'Reading & Language',
    short_description:  'Vocabulary, reading comprehension, or narrative understanding.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b17-reading-language',
  },
  {
    key: 'mathSystems', display_name: 'Math & Systems Thinking',
    short_description:  'Numerical reasoning, economic systems, or statistical thinking.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b18-math-systems',
  },
  {
    key: 'learningTransfer', display_name: 'Learning Transfer',
    short_description:  'Knowledge or skills that apply outside the game — history, science, geography, coding, music.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b19-learning-transfer',
  },
  {
    key: 'adaptiveChallenge', display_name: 'Adaptive Challenge',
    short_description:  'Difficulty that scales with player skill to maintain flow. Red flag if difficulty spikes push spending instead.',
    category: 'B1', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b110-adaptive-challenge',
  },

  // ── B2 Individual dimensions ────────────────────────────────────────────────
  {
    key: 'teamwork', display_name: 'Teamwork & Cooperation',
    short_description:  'Genuine collaboration where players depend on each other\'s contributions.',
    category: 'B2', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b21-teamwork',
  },
  {
    key: 'communication', display_name: 'Communication Skills',
    short_description:  'Meaningful communication required or encouraged between players.',
    category: 'B2', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b22-communication',
  },
  {
    key: 'empathy', display_name: 'Empathy & Perspective-Taking',
    short_description:  'Understanding other viewpoints, cultures, or emotional experiences through gameplay.',
    category: 'B2', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b23-empathy',
  },
  {
    key: 'emotionalRegulation', display_name: 'Emotional Regulation',
    short_description:  'Teaches persistence, managing frustration, or coping with loss through design — not through monetised frustration.',
    category: 'B2', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b24-emotional-regulation',
  },
  {
    key: 'ethicalReasoning', display_name: 'Ethical Reasoning',
    short_description:  'Moral dilemmas, consequences for choices, or opportunities to consider fairness.',
    category: 'B2', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b25-ethical-reasoning',
  },
  {
    key: 'positiveSocial', display_name: 'Positive Social Interaction',
    short_description:  'Multiplayer environment that fosters positive interaction, good moderation, and prosocial incentives.',
    category: 'B2', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b26-positive-social',
  },

  // ── B3 Individual dimensions ────────────────────────────────────────────────
  {
    key: 'handEyeCoord', display_name: 'Hand-Eye Coordination',
    short_description:  'Precise timing, aiming, or coordination between visual input and motor response.',
    category: 'B3', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b31-hand-eye-coordination',
  },
  {
    key: 'fineMotor', display_name: 'Fine Motor Skills',
    short_description:  'Precise small-muscle movements, dexterity, or touch precision.',
    category: 'B3', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b32-fine-motor',
  },
  {
    key: 'reactionTime', display_name: 'Reaction Time',
    short_description:  'Quick reflexes and rapid decision-making under time pressure.',
    category: 'B3', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b33-reaction-time',
  },
  {
    key: 'physicalActivity', display_name: 'Physical Activity',
    short_description:  'Whole-body movement via VR, motion controls, or augmented reality.',
    category: 'B3', level: 'individual', type: 'benefit', max_raw_score: 5, feeds_into_score: true,
    methodology_anchor: '#b34-physical-activity',
  },

  // ── R1 Individual dimensions ────────────────────────────────────────────────
  {
    key: 'variableRewards', display_name: 'Variable Ratio Rewards',
    short_description:  'Random reward systems (loot boxes, gacha) that use unpredictable outcomes to drive compulsive play.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r11-variable-rewards',
  },
  {
    key: 'streakMechanics', display_name: 'Streak Mechanics',
    short_description:  'Daily login rewards and streak systems, especially those penalise missing a day.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r12-streak-mechanics',
  },
  {
    key: 'lossAversion', display_name: 'Loss Aversion Triggers',
    short_description:  'Mechanics that punish absence — decaying resources, rank loss, or opponents advancing while you\'re away.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r13-loss-aversion',
  },
  {
    key: 'fomoEvents', display_name: 'FOMO & Time-Limited Events',
    short_description:  'Content that disappears after a deadline, creating urgency and fear of missing out.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r14-fomo-events',
  },
  {
    key: 'stoppingBarriers', display_name: 'Artificial Stopping Barriers',
    short_description:  'Energy or lives systems and other mechanics designed to frustrate stopping — especially if bypassed by spending.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r15-stopping-barriers',
  },
  {
    key: 'notifications', display_name: 'Notification & Re-engagement',
    short_description:  'Push notifications designed to create anxiety about missing content ("Your crops are dying!").',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r16-notifications',
  },
  {
    key: 'nearMiss', display_name: 'Near-Miss Mechanics',
    short_description:  'Deliberate "almost won" feedback — a gambling psychology technique that prolongs play.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r17-near-miss',
  },
  {
    key: 'infinitePlay', display_name: 'Infinite / Endless Play',
    short_description:  'Auto-play, infinite content feeds, or designs with no natural endpoint.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r18-infinite-play',
  },
  {
    key: 'escalatingCommitment', display_name: 'Escalating Commitment',
    short_description:  'Sunk-cost psychology — the more time or money invested, the harder it feels to stop.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r19-escalating-commitment',
  },
  {
    key: 'variableRewardFreq', display_name: 'Variable Reward Frequency',
    short_description:  'Deliberately unpredictable reward timing calibrated to maximise engagement — the slot machine pattern.',
    category: 'R1', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r110-variable-reward-frequency',
  },

  // ── R2 Individual dimensions ────────────────────────────────────────────────
  {
    key: 'spendingCeiling', display_name: 'Spending Ceiling',
    short_description:  'Whether there is a cap on total spending. No ceiling means unlimited monetisation.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r21-spending-ceiling',
  },
  {
    key: 'payToWin', display_name: 'Pay-to-Win',
    short_description:  'Whether spending money provides meaningful gameplay advantages over non-paying players.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r22-pay-to-win',
  },
  {
    key: 'currencyObfuscation', display_name: 'Currency Obfuscation',
    short_description:  'Multiple virtual currency layers that hide the real cost of purchases.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r23-currency-obfuscation',
  },
  {
    key: 'spendingPrompts', display_name: 'Spending Prompts',
    short_description:  'Purchase prompts triggered during gameplay — especially at frustration points.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r24-spending-prompts',
  },
  {
    key: 'childTargeting', display_name: 'Child-Targeted Monetisation',
    short_description:  'Purchase UI or mechanics specifically designed to appeal to younger users.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r25-child-targeting',
  },
  {
    key: 'adPressure', display_name: 'Ad Pressure',
    short_description:  'Frequency and intrusiveness of advertising, including unskippable or deceptive ads.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r26-ad-pressure',
  },
  {
    key: 'subscriptionPressure', display_name: 'Subscription Pressure',
    short_description:  'Whether a subscription is pushed aggressively, locks previously available features, or is hard to cancel.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r27-subscription-pressure',
  },
  {
    key: 'socialSpending', display_name: 'Social Spending Pressure',
    short_description:  'Gifting, social comparison, or peer pressure mechanics that encourage spending to keep up.',
    category: 'R2', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r28-social-spending',
  },

  // ── R3 Individual dimensions ────────────────────────────────────────────────
  {
    key: 'socialObligation', display_name: 'Social Obligation',
    short_description:  'Group expectations that create pressure to play — guild events, team commitments, social punishment for absence.',
    category: 'R3', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r31-social-obligation',
  },
  {
    key: 'competitiveToxicity', display_name: 'Competitive Toxicity',
    short_description:  'Rank anxiety, limited moderation, or environments designed in ways that encourage toxic behaviour.',
    category: 'R3', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r32-competitive-toxicity',
  },
  {
    key: 'strangerRisk', display_name: 'Stranger Interaction Risk',
    short_description:  'The degree of unmoderated contact with unknown adults — voice chat, open chat, direct messaging.',
    category: 'R3', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r33-stranger-risk',
  },
  {
    key: 'socialComparison', display_name: 'Social Comparison',
    short_description:  'Prominent leaderboards, spending-visible cosmetics, or mechanics designed to showcase and create envy.',
    category: 'R3', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r34-social-comparison',
  },
  {
    key: 'identitySelfWorth', display_name: 'Identity & Self-Worth',
    short_description:  'How strongly the game links self-worth to in-game performance, achievements, or virtual possessions.',
    category: 'R3', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r35-identity-self-worth',
  },
  {
    key: 'privacyRisk', display_name: 'Privacy Risk',
    short_description:  'Extent of behavioural tracking and data collection on minors, especially without transparent consent.',
    category: 'R3', level: 'individual', type: 'risk', max_raw_score: 3, feeds_into_score: true,
    methodology_anchor: '#r36-privacy-risk',
  },

  // ── R4 Individual dimensions (display only) ─────────────────────────────────
  {
    key: 'violenceLevel', display_name: 'Violence',
    short_description:  'Level of violent content from mild cartoon to graphic realistic violence.',
    category: 'R4', level: 'individual', type: 'display', max_raw_score: 3, feeds_into_score: false,
    methodology_anchor: '#r41-violence',
  },
  {
    key: 'sexualContent', display_name: 'Sexual Content',
    short_description:  'Level of sexual or suggestive content.',
    category: 'R4', level: 'individual', type: 'display', max_raw_score: 3, feeds_into_score: false,
    methodology_anchor: '#r42-sexual-content',
  },
  {
    key: 'language', display_name: 'Language',
    short_description:  'Frequency and severity of profanity.',
    category: 'R4', level: 'individual', type: 'display', max_raw_score: 3, feeds_into_score: false,
    methodology_anchor: '#r43-language',
  },
  {
    key: 'substanceRef', display_name: 'Substance References',
    short_description:  'Depiction of drug, alcohol, or tobacco use and how it is framed.',
    category: 'R4', level: 'individual', type: 'display', max_raw_score: 3, feeds_into_score: false,
    methodology_anchor: '#r44-substance-references',
  },
  {
    key: 'fearHorror', display_name: 'Fear & Horror',
    short_description:  'Frightening or disturbing imagery that may be overwhelming for younger players.',
    category: 'R4', level: 'individual', type: 'display', max_raw_score: 3, feeds_into_score: false,
    methodology_anchor: '#r45-fear-horror',
  },
]

// ── Convenience lookups ──────────────────────────────────────────────────────

/** O(1) lookup by DB column key. */
export const DIMENSION_BY_KEY: Record<string, Dimension> =
  Object.fromEntries(DIMENSIONS.map(d => [d.key, d]))

/** All dimensions for a given category, in rubric order. */
export function dimensionsByCategory(category: DimensionCategory): Dimension[] {
  return DIMENSIONS.filter(d => d.category === category)
}

/** Only the category-level dimensions (the computed scores on game_scores). */
export const CATEGORY_DIMENSIONS = DIMENSIONS.filter(d => d.level === 'category')

/** Only the individual-level dimensions (the raw inputs on reviews). */
export const INDIVIDUAL_DIMENSIONS = DIMENSIONS.filter(d => d.level === 'individual')
