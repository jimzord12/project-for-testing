# Psychological Maturity Questionnaire — Domain Specification

**Document type:** Domain definition  
**Status:** Draft v1.0  
**Canonical product concept:** Reflective Maturity Profile  
**Working public title:** Psychological Age Test  
**Audience:** Product engineers, domain reviewers, prompt engineers, QA, and future psychometric advisors

---

## 1. Purpose

This document defines the meaning, rules, content, scoring, constraints, and language of the questionnaire.

It is the source of truth for:

- what the questionnaire measures;
- what it explicitly does not measure;
- the six profile dimensions;
- the canonical question bank;
- deterministic scoring;
- narrative scoring;
- confidence calculation;
- result interpretation;
- anti-gaming rules;
- safety and fairness constraints.

Implementation details belong in the accompanying PRD/SPEC.

---

## 2. Product Truth

The questionnaire is a **reflective self-assessment of maturity-related behaviors**. It is not a clinical test and does not calculate a person's literal psychological age.

The product may offer a **maturity-age metaphor** for entertainment and accessibility, but the canonical result is a **Maturity Profile** consisting of:

1. Structured Maturity Index, 0–100
2. Five structured dimension scores, 0–100
3. Narrative Self-Awareness score, 0–100, when enough narrative content is provided
4. Confidence label: High, Moderate, or Low
5. Evidence-based observations
6. Two or three behavioral experiments

### Required public disclaimer

> This is a reflective self-assessment, not a diagnosis or a scientifically validated measure of literal psychological age. Results depend on self-report, interpretation, current circumstances, and how specifically you answer.

### Naming rule

Use **Maturity Profile** or **Reflective Maturity Profile** in explanatory and result copy.

The phrase **Psychological Age** may be used only as:

- a working product title;
- an optional metaphorical result;
- copy that is immediately qualified as non-clinical and non-literal.

---

## 3. Non-Goals

The questionnaire must not attempt to:

- diagnose a mental-health condition;
- infer trauma, attachment style, neurodivergence, personality disorder, or childhood history;
- measure intelligence, morality, worth, employability, relationship fitness, or social status;
- claim scientific validation without a completed validation study;
- rank cultures, age groups, genders, or personality styles;
- treat emotional restraint, extroversion, conformity, or long-term planning as automatically mature;
- punish a user for skipping sensitive narrative questions;
- present a single score as precise or definitive.

---

## 4. Domain Principles

### 4.1 Behavior over ideals

Questions ask what the user **actually did in a recent real situation**, not what they believe a mature person should do.

### 4.2 Context over personality preference

Scoring rewards proportionality, deliberateness, repair, updating, and awareness of trade-offs. It does not reward one communication or temperament style by default.

### 4.3 Balanced functioning over perfection

Maturity is not permanent calm, endless delay, radical independence, or total future orientation. Several items are deliberately midpoint- or context-optimal.

### 4.4 Evidence over AI intuition

The language model may interpret and personalize. It must not invent evidence or choose the structured score.

### 4.5 Confidence over false precision

Incomplete or inconsistent response sets reduce confidence rather than being silently treated as immaturity.

### 4.6 Growth over judgment

Results describe patterns and experiments. They do not label users as childish, broken, advanced, superior, or deficient.

---

## 5. Profile Dimensions

| ID  | Dimension                | Domain definition                                                                                                                        | Typical mature signal                                                                       | Common scoring mistake to avoid                                  |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| ER  | Emotional Regulation     | Recognizing, tolerating, expressing, recovering from, and repairing around emotion without avoidant suppression or uncontrolled overflow | Emotion is identified accurately, action remains proportionate, and repair follows mistakes | Treating calm appearance as proof of regulation                  |
| IC  | Impulse Control          | Creating enough space between urge and action to choose deliberately, while still acting when action is needed                           | Uses pauses, environmental design, reversible decisions, and honest renegotiation           | Treating delay or rigid self-denial as automatically mature      |
| PT  | Perspective-Taking       | Representing other viewpoints fairly, tolerating ambiguity, separating delivery from content, and updating beliefs                       | Can explain competing views and revise conclusions based on evidence                        | Treating agreement, passivity, or indecision as open-mindedness  |
| IS  | Identity Stability       | Maintaining a coherent, revisable self-concept under approval pressure, criticism, status differences, and group influence               | Adapts style without falsifying values, facts, or identity                                  | Treating stubbornness or opposition as independence              |
| TD  | Temporal Depth           | Integrating present needs, future consequences, uncertainty, reversibility, commitments, and long-horizon priorities                     | Plans with checkpoints and balances present and future costs                                | Treating anxiety-driven overplanning or self-denial as foresight |
| NSA | Narrative Self-Awareness | Describing one's own behavior with specificity, ownership, emotional precision, uncertainty, and evidence of learning                    | Concrete event, honest motive, named pattern, clear uncertainty, behavioral revision        | Rewarding sophisticated vocabulary or therapeutic language       |

---

## 6. Questionnaire Structure

### 6.1 Canonical composition

- 24 structured questions
- 5 structured dimensions
- 2 optional narrative exercises
- 26 total interaction steps
- Expected completion time: approximately 12–18 minutes

### 6.2 Structured item distribution

| Dimension            | Question count | Weight in Structured Maturity Index |
| -------------------- | -------------: | ----------------------------------: |
| Emotional Regulation |              5 |                                 20% |
| Impulse Control      |              5 |                                 20% |
| Perspective-Taking   |              5 |                                 20% |
| Identity Stability   |              4 |                                 20% |
| Temporal Depth       |              5 |                                 20% |

Dimensions are equally weighted even though Identity Stability has four items. Each dimension is normalized before aggregation.

### 6.3 Narrative placement

Narrative exercises are placed mid-flow rather than grouped at the end:

- Narrative Exercise 1 after structured item 8
- Narrative Exercise 2 after structured item 14

### 6.4 Response options

Every structured item provides:

- five behaviorally anchored options;
- one `Not applicable / I cannot recall a relevant situation` option.

`Not applicable` is never scored as immature. It removes the item from the denominator and may reduce confidence.

---

## 7. Canonical Structured Question Bank

The following IDs and score mappings are canonical for questionnaire version `RMP-1.0`.

Scores are hidden from users.

### ER01 — Receiving criticism

**Prompt:** Think of the last criticism that stayed with you after the conversation. What did you actually do first?

| Option | User-facing answer                                                                            | Score |
| ------ | --------------------------------------------------------------------------------------------- | ----: |
| A      | I responded before I had fully understood what they meant.                                    |     1 |
| B      | I defended myself point by point, then later noticed that I had missed part of the criticism. |     2 |
| C      | I asked for a concrete example, paused, and responded after I understood the specific claim.  |     5 |
| D      | I said very little, but replayed the conversation and avoided the person afterward.           |     2 |
| E      | I acknowledged the useful part and directly challenged the part I believed was unfair.        |     4 |

### ER02 — Naming an emotion

**Prompt:** During the last emotionally intense situation you remember clearly, how accurately could you identify what you were feeling?

| Option | User-facing answer                                                                                | Score |
| ------ | ------------------------------------------------------------------------------------------------- | ----: |
| A      | I mainly knew that I felt bad, stressed, or overwhelmed.                                          |     1 |
| B      | I identified the broad emotion several hours later.                                               |     2 |
| C      | I could distinguish the specific emotion and what it was pushing me to do while it was happening. |     5 |
| D      | I identified the emotion quickly and treated it as proof that my interpretation was correct.      |     3 |
| E      | My first label was incomplete, but I revised it after noticing more of what was going on.         |     4 |

### ER03 — Recovery after activation

**Prompt:** After the last conflict that genuinely affected you, what best describes your recovery?

| Option | User-facing answer                                                                           | Score |
| ------ | -------------------------------------------------------------------------------------------- | ----: |
| A      | I appeared normal quickly and did not think about it again.                                  |     3 |
| B      | I took deliberate steps to settle, then returned to the issue with a clearer view.           |     5 |
| C      | It affected me for a day or more, but I continued functioning and eventually processed it.   |     3 |
| D      | I replayed it for days and repeatedly reopened the argument in my head or with other people. |     1 |
| E      | I acted as if it was over, but the tension remained in my body or behavior.                  |     2 |

### ER04 — Repair after causing harm

**Prompt:** Think of the last time your behavior hurt or unfairly affected someone. What happened next?

| Option | User-facing answer                                                                                      | Score |
| ------ | ------------------------------------------------------------------------------------------------------- | ----: |
| A      | I apologized, but spent most of the conversation explaining what I intended.                            |     2 |
| B      | I waited for them to raise it again because I did not want to make the situation worse.                 |     1 |
| C      | I named what I did, acknowledged the likely impact, and asked what repair would be useful.              |     5 |
| D      | I apologized quickly to end the tension, but did not change the repeated behavior.                      |     2 |
| E      | I accepted the part that was mine, disagreed with what was not mine, and changed one concrete behavior. |     4 |

### ER05 — Functioning under emotional pressure

**Prompt:** In the last high-pressure situation where strong emotion could have affected an important decision, what did you do?

| Option | User-facing answer                                                                         | Score |
| ------ | ------------------------------------------------------------------------------------------ | ----: |
| A      | I suppressed the emotion completely until the task was over, then made time to process it. |     4 |
| B      | I expressed it immediately because holding it in felt dishonest.                           |     1 |
| C      | I took a short, explicit pause and returned when I could act proportionately.              |     5 |
| D      | I distracted myself until the feeling passed and avoided revisiting the issue.             |     2 |
| E      | I looked for reassurance before I felt able to decide.                                     |     3 |

### IC01 — Emotionally charged communication

**Prompt:** The last time you wrote a message while angry, hurt, or anxious, what did you do?

| Option | User-facing answer                                                                                   | Score |
| ------ | ---------------------------------------------------------------------------------------------------- | ----: |
| A      | I sent it while the emotion was still at its peak.                                                   |     1 |
| B      | I drafted it, waited at least twenty minutes, and reviewed whether the message still served my goal. |     4 |
| C      | Because it was not urgent, I waited until the next day and then decided whether to send anything.    |     5 |
| D      | I did not send it, but later expressed the same anger indirectly.                                    |     2 |
| E      | I rewrote it repeatedly because I was trying to eliminate every possible negative reaction.          |     3 |

### IC02 — Designing around temptation

**Prompt:** When a repeated temptation conflicts with a longer-term goal, which pattern best matches what you have actually done?

| Option | User-facing answer                                                                                   | Score |
| ------ | ---------------------------------------------------------------------------------------------------- | ----: |
| A      | I usually choose the immediate reward and deal with the cost later.                                  |     1 |
| B      | I rely on willpower in the moment, with mixed results.                                               |     2 |
| C      | I change the environment in advance so the preferred action becomes easier.                          |     5 |
| D      | I sometimes choose the reward deliberately and accept the cost without pretending it was accidental. |     4 |
| E      | I remove nearly all rewards because any exception feels dangerous.                                   |     3 |

### IC03 — Frustration tolerance

**Prompt:** Think of the last difficult task that stopped progressing. What did you do after the first few failed attempts?

| Option | User-facing answer                                                                                  | Score |
| ------ | --------------------------------------------------------------------------------------------------- | ----: |
| A      | I switched to something easier and did not return.                                                  |     1 |
| B      | I forced myself through it while getting increasingly angry, and the quality dropped.               |     2 |
| C      | I broke the problem into smaller parts, tried a different route, and returned with new information. |     5 |
| D      | I defined what I had already tried, then asked for help.                                            |     4 |
| E      | I kept repeating roughly the same approach because stopping felt like failure.                      |     2 |

### IC04 — Keeping or renegotiating commitments

**Prompt:** The last time you were likely to miss a meaningful commitment, what did you do?

| Option | User-facing answer                                                                      | Score |
| ------ | --------------------------------------------------------------------------------------- | ----: |
| A      | I waited to see whether motivation would return.                                        |     1 |
| B      | I relied on a last-minute sprint.                                                       |     2 |
| C      | I reduced the work to a minimum viable step and completed that step consistently.       |     5 |
| D      | I communicated early, renegotiated honestly, and accepted the inconvenience caused.     |     4 |
| E      | I quietly dropped a lower-priority promise because I had accepted too many commitments. |     2 |

### IC05 — Decisions under urgency

**Prompt:** Think of the last consequential decision that felt urgent but was not an emergency. What best describes your process?

| Option | User-facing answer                                                                           | Score |
| ------ | -------------------------------------------------------------------------------------------- | ----: |
| A      | I acted quickly mainly to remove the discomfort of uncertainty.                              |     1 |
| B      | I delayed until some useful options were no longer available.                                |     2 |
| C      | I gathered the minimum information needed, set a decision deadline, and chose deliberately.  |     5 |
| D      | I handed the decision to someone else because I did not want responsibility for the outcome. |     2 |
| E      | I chose the most reversible reasonable option and scheduled a review point.                  |     4 |

### PT01 — Handling disagreement

**Prompt:** During the last disagreement with someone you respect, what did you actually do?

| Option | User-facing answer                                                                  | Score |
| ------ | ----------------------------------------------------------------------------------- | ----: |
| A      | I focused on demonstrating where their reasoning failed.                            |     1 |
| B      | I avoided the disagreement to protect the relationship.                             |     2 |
| C      | I asked questions and summarized their reasoning before explaining my own view.     |     5 |
| D      | I agreed outwardly, then dismissed their position privately.                        |     2 |
| E      | I identified the strongest part of their case while keeping my original conclusion. |     4 |

### PT02 — Updating a belief

**Prompt:** Think of the most recent time you changed your mind about something that mattered. What caused the change?

| Option | User-facing answer                                                              | Score |
| ------ | ------------------------------------------------------------------------------- | ----: |
| A      | I cannot recall changing my mind about anything important recently.             |     1 |
| B      | Someone I trust or admire told me I was wrong.                                  |     2 |
| C      | New evidence contradicted the prediction my previous belief would have made.    |     5 |
| D      | A real consequence exposed a blind spot I had not considered.                   |     4 |
| E      | I changed my stated position because disagreement was becoming socially costly. |     2 |

### PT03 — Tolerating ambiguity

**Prompt:** When the available evidence supports more than one plausible explanation, which pattern is closest to your own?

| Option | User-facing answer                                                                            | Score |
| ------ | --------------------------------------------------------------------------------------------- | ----: |
| A      | I choose an explanation quickly because uncertainty is distracting.                           |     1 |
| B      | I keep collecting information and struggle to commit to any view.                             |     2 |
| C      | I hold multiple explanations and deliberately look for evidence that could disprove each one. |     5 |
| D      | I adopt a provisional explanation and update it when new information arrives.                 |     4 |
| E      | I use the majority view until there is a strong reason not to.                                |     3 |

### PT04 — Separating delivery from substance

**Prompt:** The last time useful feedback was delivered badly, what did you do?

| Option | User-facing answer                                                                     | Score |
| ------ | -------------------------------------------------------------------------------------- | ----: |
| A      | I rejected the content because the delivery was disrespectful.                         |     1 |
| B      | I accepted almost all of it because I wanted to prove I was open-minded.               |     2 |
| C      | I separated the delivery from the claim and evaluated each independently.              |     5 |
| D      | I rejected it in the moment but reconsidered it privately later.                       |     3 |
| E      | I asked for a concrete example and tested whether the claim matched a broader pattern. |     4 |

### PT05 — Explaining another person's behavior

**Prompt:** When someone recently disappointed you, what explanation did you begin with?

| Option | User-facing answer                                                                                  | Score |
| ------ | --------------------------------------------------------------------------------------------------- | ----: |
| A      | I assumed it revealed a flaw in their character.                                                    |     1 |
| B      | I assumed I had caused the problem.                                                                 |     2 |
| C      | I considered both situational and personal explanations and looked for information before deciding. |     5 |
| D      | I chose the most charitable explanation even though the behavior crossed a boundary.                |     3 |
| E      | I withheld a strong conclusion until I could see whether it was a repeated pattern.                 |     4 |

### IS01 — Group pressure

**Prompt:** Think of the last time your view differed from a group whose approval mattered to you. What did you do?

| Option | User-facing answer                                                                       | Score |
| ------ | ---------------------------------------------------------------------------------------- | ----: |
| A      | I changed my stated view so I would not stand out.                                       |     1 |
| B      | I became more certain and forceful mainly to prove that I was independent.               |     2 |
| C      | I stated my actual level of certainty without performing confidence or agreement.        |     5 |
| D      | I stayed quiet in the moment but made the later decision according to my own priorities. |     4 |
| E      | I matched the group's tone more than its actual beliefs.                                 |     3 |

### IS02 — Feedback and self-worth

**Prompt:** After the last piece of negative feedback from someone important to you, what happened to your view of yourself?

| Option | User-facing answer                                                                            | Score |
| ------ | --------------------------------------------------------------------------------------------- | ----: |
| A      | My overall sense of competence or worth dropped for much of the day.                          |     1 |
| B      | I dismissed the feedback to protect my confidence.                                            |     2 |
| C      | I compared it with evidence, my values, and other observations before deciding what it meant. |     5 |
| D      | I asked several people for reassurance until I felt stable again.                             |     2 |
| E      | I accepted the useful part without turning it into a global judgment about myself.            |     4 |

### IS03 — Status and self-presentation

**Prompt:** Around a person or group you perceived as high-status, what did you notice yourself doing most recently?

| Option | User-facing answer                                                               | Score |
| ------ | -------------------------------------------------------------------------------- | ----: |
| A      | I exaggerated my competence, certainty, or interests.                            |     1 |
| B      | I withdrew because I expected to be evaluated negatively.                        |     2 |
| C      | I noticed the urge to perform and kept my claims accurate.                       |     5 |
| D      | I adapted my communication style without changing facts, values, or commitments. |     4 |
| E      | I challenged them more aggressively than necessary to prove equality.            |     2 |

### IS04 — Values under social cost

**Prompt:** Think of a recent decision where your own priorities conflicted with what other people expected. What did you do?

| Option | User-facing answer                                                                          | Score |
| ------ | ------------------------------------------------------------------------------------------- | ----: |
| A      | I chose the option most likely to preserve approval.                                        |     1 |
| B      | I chose the opposite of what was expected because compliance felt weak.                     |     2 |
| C      | I named the trade-off and chose according to priorities I had already considered important. |     5 |
| D      | I compromised a preference without violating a core value.                                  |     4 |
| E      | I postponed the decision because either choice could disappoint someone.                    |     2 |

### TD01 — Consequence horizon

**Prompt:** In a recent meaningful decision, how far ahead did you genuinely consider the consequences?

| Option | User-facing answer                                                                          | Score |
| ------ | ------------------------------------------------------------------------------------------- | ----: |
| A      | I mainly considered what would make today easier.                                           |     1 |
| B      | I considered the next few months once the consequences became hard to ignore.               |     2 |
| C      | I considered immediate, one-year, and multi-year effects before deciding.                   |     5 |
| D      | I prioritized the distant future so strongly that present needs received too little weight. |     3 |
| E      | I chose a reversible step that created information for the next decision.                   |     4 |

### TD02 — Planning under uncertainty

**Prompt:** When planning something important with uncertain conditions, which approach best matches your recent behavior?

| Option | User-facing answer                                                                           | Score |
| ------ | -------------------------------------------------------------------------------------------- | ----: |
| A      | I avoided making a plan because too much could change.                                       |     1 |
| B      | I made a detailed plan and treated deviations as failure.                                    |     2 |
| C      | I planned multiple scenarios, decision triggers, and a reasonable buffer.                    |     5 |
| D      | I chose a direction and scheduled a checkpoint rather than pretending to know the full path. |     4 |
| E      | I followed another person's plan because they seemed more certain.                           |     2 |

### TD03 — Persisting without immediate reward

**Prompt:** Think of a goal that produced little visible progress for several weeks. What did you do?

| Option | User-facing answer                                                                          | Score |
| ------ | ------------------------------------------------------------------------------------------- | ----: |
| A      | I abandoned it because the lack of progress suggested it was not working.                   |     1 |
| B      | I continued mainly from guilt, without reviewing whether the method made sense.             |     2 |
| C      | I tracked leading indicators, reviewed the method, and adjusted while preserving the goal.  |     5 |
| D      | I reduced the pace to something sustainable and continued.                                  |     4 |
| E      | I invested more time even when it was damaging health, relationships, or other commitments. |     3 |

### TD04 — Mortality and priorities

**Prompt:** When you think about limited time or mortality, how does it affect actual decisions?

| Option | User-facing answer                                                                | Score |
| ------ | --------------------------------------------------------------------------------- | ----: |
| A      | It is mostly an abstract thought and rarely changes behavior.                     |     2 |
| B      | It makes recognition, achievement, or being remembered feel especially important. |     2 |
| C      | It clarifies concrete priorities, boundaries, and commitments.                    |     5 |
| D      | It makes long-term effort feel pointless.                                         |     1 |
| E      | It prompts periodic rebalancing without dominating everyday life.                 |     4 |

### TD05 — Present and future balance

**Prompt:** Which statement best matches how you handled a recent choice between present enjoyment and future security?

| Option | User-facing answer                                                                               | Score |
| ------ | ------------------------------------------------------------------------------------------------ | ----: |
| A      | I chose the present benefit and assumed my future self would handle the cost.                    |     1 |
| B      | I denied the present need because future security felt more important than almost anything else. |     3 |
| C      | I explicitly allocated something to both the present and the future.                             |     5 |
| D      | I swung between indulgence and restriction without a stable rule.                                |     2 |
| E      | I prioritized according to the size, reversibility, and timing of the consequences.              |     4 |

---

## 8. Narrative Exercises

Narrative exercises are optional. Skipping them does not reduce the Structured Maturity Index.

### N01 — The Friction Story

**Intro copy:**

> Describe one real situation from the last 12 months. Concrete detail is more useful than polished language. There is no ideal type of answer.

**Fields:**

1. **What happened, and what did you do?** — maximum 90 words
2. **What were you telling yourself at the time?** — maximum 60 words
3. **What do you understand differently now?** — maximum 90 words

**Minimum content for AI scoring:** 45 total words across all three fields.

### N02 — The Unsolved Pattern

**Intro copy:**

> Describe a pattern you can observe but do not fully understand. This could involve a repeated reaction, a type of person who affects you unusually strongly, or a decision pattern you keep repeating.

**Fields:**

1. **What is the repeated pattern?** — maximum 70 words
2. **When or around whom does it tend to appear?** — maximum 50 words
3. **What part remains genuinely unclear to you?** — maximum 70 words

**Minimum content for AI scoring:** 35 total words across all three fields.

### Narrative privacy copy

> These answers may contain personal information. You can skip them and still receive the structured profile. When AI analysis is enabled, the text is sent to the configured AI provider for this analysis.

---

## 9. Deterministic Scoring

### 9.1 Item score

Each scored option has an integer score from 1 to 5.

`Not applicable` has a value of `null`.

### 9.2 Dimension score

For a dimension with `n` answered items:

```text
raw_mean = sum(answer_scores) / n
dimension_score = round(((raw_mean - 1) / 4) * 100)
```

A dimension is reportable only when at least:

- 4 of 5 items are answered for ER, IC, PT, and TD;
- 3 of 4 items are answered for IS.

Otherwise, return `insufficient_data` for that dimension.

### 9.3 Structured Maturity Index

When all five dimensions are reportable:

```text
structured_maturity_index = round(
  (ER + IC + PT + IS + TD) / 5
)
```

The index is the equally weighted mean of normalized dimensions.

Do not apply an undisclosed penalty, ceiling, or LLM adjustment.

### 9.4 Profile balance

Profile balance is descriptive, not punitive.

```text
profile_spread = max(reportable_dimension_scores) - min(reportable_dimension_scores)
```

Interpretation:

| Spread | Label                   |
| -----: | ----------------------- |
|   0–14 | Relatively balanced     |
|  15–29 | Some unevenness         |
|    30+ | Strongly uneven profile |

### 9.5 Optional maturity-age metaphor

The metaphor is calculated only when the user explicitly enables it:

```text
maturity_age_metaphor = round(16 + (structured_maturity_index / 100) * 56)
```

Required adjacent copy:

> This is a playful mapping of the index onto a 16–72 scale. It is not your literal or clinical psychological age, and older does not mean more valuable.

The metaphor must never replace the 0–100 index as the primary result.

Chronological age is optional and must not affect scoring.

---

## 10. Narrative Self-Awareness Scoring

### 10.1 Role of the language model

The model does not decide the structured score or final index. It assigns rubric values and provides evidence. Application code validates the rubric and calculates the narrative score.

### 10.2 Rubric

Each criterion is scored `0`, `1`, or `2`.

| Criterion              | 0                                            | 1                                          | 2                                                                                               |
| ---------------------- | -------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Specificity            | Generic or no concrete event/pattern         | Some details but key parts remain abstract | Concrete behavior, context, and consequence                                                     |
| Ownership              | Responsibility externalized or avoided       | Partial ownership mixed with justification | Clear ownership without theatrical self-condemnation                                            |
| Emotional precision    | No emotion or only vague labels              | Broad emotional label                      | Specific emotion, urge, conflict, or bodily/behavioral signal                                   |
| Causal depth           | No explanation beyond a slogan               | One plausible factor                       | Distinguishes trigger, interpretation, motive, and consequence                                  |
| Quality of uncertainty | Claims certainty or offers generic confusion | Names uncertainty without boundaries       | Clearly identifies what is known and what remains unknown                                       |
| Behavioral integration | No observed revision                         | States a lesson                            | Describes changed behavior, a testable intention, or evidence that behavior has not yet changed |

### 10.3 Performative-abstraction penalty

The model may assign a penalty from `0` to `2`:

- `0`: language is mostly concrete;
- `1`: some polished abstraction, cliché, or self-flattery obscures evidence;
- `2`: the answer primarily performs insight without demonstrating it.

Sophisticated vocabulary alone is not evidence of self-awareness.

### 10.4 Narrative score calculation

```text
positive_total = sum(six_criteria)          // 0–12
adjusted_total = max(0, positive_total - penalty)
narrative_self_awareness = round((adjusted_total / 12) * 100)
```

If either exercise fails its minimum-content threshold, the model may analyze the available content but the product must label the narrative score `limited_evidence`.

If both exercises are skipped or below threshold, return `not_scored`, not zero.

### 10.5 Required model evidence

For every rubric criterion, the model returns:

- integer score;
- one-sentence rationale;
- zero or one short evidence excerpt from the user's text.

Evidence excerpts must be brief and must not be invented.

---

## 11. Confidence Calculation

Confidence describes the stability of the result given the available response set. It is not a truthfulness score.

### 11.1 Base confidence

Start at `100`.

### 11.2 Coverage deductions

- subtract 5 for each `Not applicable` response after the first two;
- subtract 15 for each non-reportable structured dimension;
- subtract 10 when more than four structured items are unanswered or not applicable.

### 11.3 Loose consistency checks

The following pairs should usually be directionally related but are not duplicates:

- ER01 and ER05
- IC01 and IC05
- PT02 and PT03
- IS01 and IS03
- TD01 and TD03

Normalize each item score to 0–100. If a pair differs by more than 75 points, subtract 5.

A discrepancy never changes a dimension score and must not be described as deception.

### 11.4 Confidence label

Clamp confidence to `0–100`.

|  Score | Label    |
| -----: | -------- |
| 85–100 | High     |
|  65–84 | Moderate |
|   0–64 | Low      |

### 11.5 Narrative confidence

Narrative confidence is separate:

- `High`: both exercises meet threshold;
- `Moderate`: one meets threshold and the other contains meaningful content;
- `Low`: only one short exercise contains useful content;
- `Not available`: no scorable narrative content.

---

## 12. Interpretation Rules

### 12.1 Dimension bands

Bands are descriptive UI aids, not diagnoses.

|  Score | Label                                 | Interpretation style                                                                         |
| -----: | ------------------------------------- | -------------------------------------------------------------------------------------------- |
|   0–24 | Currently constrained                 | This behavior appears difficult or inconsistently available in the reported situations       |
|  25–44 | Emerging                              | Some useful responses appear, but they are not yet reliable under pressure                   |
|  45–64 | Functional                            | The capacity is present and generally usable, with meaningful context-specific gaps          |
|  65–84 | Strong                                | The capacity appears reliable in many situations, while still having identifiable edge cases |
| 85–100 | Highly developed in this response set | The reported behavior strongly demonstrates the dimension; avoid calling it mastery          |

### 12.2 Result priority

Results must be ordered as:

1. Structured Maturity Index and confidence
2. Dimension profile
3. Profile balance
4. Evidence-based observations
5. Narrative Self-Awareness, when available
6. Behavioral experiments
7. Optional maturity-age metaphor

### 12.3 Growth-area selection

Select two or three dimensions using:

1. the lowest reportable dimension scores;
2. meaningful item-level patterns;
3. narrative evidence, when relevant;
4. user impact, not score alone.

Do not imply that every lower score requires correction. A recommendation must identify a concrete situation in which the behavior creates a cost.

---

## 13. AI Interpretation Contract

### 13.1 Allowed

The AI may:

- summarize score patterns;
- connect a structured answer with a concrete narrative detail;
- identify contradictions as possibilities;
- distinguish observation from interpretation;
- propose observable experiments;
- state uncertainty;
- mention that context may explain an answer.

### 13.2 Prohibited

The AI must not:

- diagnose;
- infer trauma, attachment style, neurotype, personality disorder, or family history;
- claim to know unconscious motives;
- present speculation as fact;
- praise or shame the user globally;
- use maturity as a proxy for human worth;
- recommend medication;
- present therapy as the default answer;
- quote more user text than necessary;
- change deterministic scores;
- compare the user with unsupported population percentiles.

### 13.3 Observation format

Each major interpretation should follow this structure:

1. **Observed pattern:** what the response set shows
2. **Possible interpretation:** a bounded explanation using words such as “may” or “could”
3. **Behavioral experiment:** a concrete way to test or improve the pattern

### 13.4 Behavioral experiment requirements

Every experiment contains:

- a trigger;
- a specific behavior;
- a measurement;
- a review period;
- a stop condition when the experiment is counterproductive.

Example:

> For the next 14 days, when you draft a non-urgent conflict message, wait 20 minutes before sending it. Record whether you materially change the message and whether you regret the final version. Stop using the delay when immediate clarification is necessary for safety or operations.

---

## 14. Anti-Gaming Architecture

The questionnaire reduces answer optimization through design, not trickery.

Required mechanisms:

1. Memory framing: recent real situations rather than hypothetical ideals
2. Behaviorally anchored answers
3. Context-sensitive and midpoint-optimal options
4. Cross-item consistency checks used only for confidence
5. Narrative specificity requirements
6. Hidden score mappings
7. No immediate per-question feedback
8. No language implying an obviously “mature” identity
9. Optional delayed retake comparison in later versions

Pure gotcha questions and opaque reverse traps are prohibited.

---

## 15. Safety Handling

### 15.1 General distress

The app may acknowledge distress briefly, but it must not turn the result into a clinical assessment.

### 15.2 Immediate-risk content

If narrative content indicates a credible and immediate risk of self-harm, suicide, harm to another person, or an active emergency:

- do not score or analyze that content as a maturity signal;
- interrupt the normal personalized-analysis flow;
- show a calm safety message and locally appropriate emergency/help resources;
- still allow the structured result to be viewed when appropriate;
- do not generate speculative psychological commentary.

### 15.3 Age policy

MVP is intended for adults aged 18 and above.

Chronological age is optional except for confirming eligibility. Store only an `is_adult` confirmation unless a later feature genuinely requires exact age.

---

## 16. Fairness Rules

Question and result copy must be reviewed for:

- cultural assumptions about confrontation, independence, and family duty;
- socioeconomic assumptions about long-term planning and delayed gratification;
- disability and neurodivergence assumptions around emotion, attention, and communication;
- gendered expectations around assertiveness and emotional expression;
- language complexity that rewards education rather than self-awareness.

When circumstances may plausibly explain a response, the result should say so.

---

## 17. Versioning

Every assessment records:

- `questionnaire_version`, initially `RMP-1.0`;
- `scoring_version`, initially `RMP-SCORE-1.0`;
- `prompt_version`, initially `RMP-AI-1.0`;
- locale;
- completion timestamp;
- whether the optional age metaphor was enabled.

Question wording, answer order, score maps, rubric rules, and prompt changes require a version increment.

Do not compare scores across versions unless a migration or equivalence study exists.

---

## 18. Future Validation Path

Until validation work is completed, product copy must remain explicitly exploratory.

Recommended future work:

1. Expert review of construct definitions and item content
2. Cognitive interviews to identify misunderstood items
3. Pilot sample analysis
4. Reliability analysis by dimension
5. Factor analysis
6. Test–retest analysis
7. Measurement-invariance review across major demographic groups
8. Correlation with established non-diagnostic maturity-related measures
9. Revision of weak or biased items

No scientific-validity claim may be added based only on internal consistency or user popularity.

---

## 19. Canonical Result Object

```json
{
  "questionnaire_version": "RMP-1.0",
  "scoring_version": "RMP-SCORE-1.0",
  "structured_maturity_index": 68,
  "confidence": {
    "score": 88,
    "label": "high",
    "reasons": []
  },
  "dimensions": {
    "emotional_regulation": { "score": 70, "status": "reportable" },
    "impulse_control": { "score": 55, "status": "reportable" },
    "perspective_taking": { "score": 80, "status": "reportable" },
    "identity_stability": { "score": 69, "status": "reportable" },
    "temporal_depth": { "score": 65, "status": "reportable" }
  },
  "profile_balance": {
    "spread": 25,
    "label": "some_unevenness"
  },
  "narrative": {
    "status": "scored",
    "score": 67,
    "confidence": "high",
    "rubric": {
      "specificity": 2,
      "ownership": 1,
      "emotional_precision": 1,
      "causal_depth": 1,
      "quality_of_uncertainty": 2,
      "behavioral_integration": 2,
      "performative_abstraction_penalty": 1
    }
  },
  "maturity_age_metaphor": null
}
```

---

## 20. Definition of Domain Correctness

An implementation is domain-correct only when:

- question wording and score mappings match the active questionnaire version;
- `Not applicable` is excluded rather than scored;
- every dimension is normalized independently;
- the Structured Maturity Index is deterministic and reproducible;
- the model cannot modify deterministic scores;
- narrative scoring follows the rubric and is computed by application code;
- confidence is reported separately from score;
- results include the non-clinical disclaimer;
- the optional age metaphor is secondary and explicitly qualified;
- AI output is evidence-backed and non-diagnostic;
- skipped narrative content is not treated as immaturity.

---

## 21. Provenance

This specification evolves the original `Psychological-Age-Test.v1.md` concept by preserving its reflective dimensions, mid-quiz narrative exercises, personalized AI analysis, anti-gaming intent, and visual direction while replacing literal-age claims, opaque traps, and LLM-controlled scoring with a more defensible domain model.
