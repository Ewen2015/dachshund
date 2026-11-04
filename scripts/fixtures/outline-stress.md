## Overview

This fixture exercises a dense Markdown outline in the compact memory inspector.

### Reader context

The reader should preserve hierarchy without letting indentation consume the label.

#### 当标题很长时仍然需要看见足够多的有效文字

Deep headings must retain a readable amount of text in the narrow inspector.

#### A long implementation note should still identify its subject

The full label remains available through hover and assistive technology.

### Layout constraints

The contents rail is wider than the original fixed-width implementation.

#### Nested headings cannot be allowed to consume the entire label width

Visual depth is capped while the semantic heading level remains unchanged.

#### Keyboard focus must expose the complete section title

The button carries a complete accessible label and a native title.

## Product context

The outline is navigation, so recognizability matters more than showing every word.

### Compact inspector

The ordinary detail pane is the primary regression target.

#### 普通侧栏中的四级标题不能再只剩下一两个字

At least a useful phrase should remain visible before the ellipsis.

#### Active section tracking should not move the reading surface

Only the contents rail scrolls to keep the current item in view.

### Reading mode

The expanded reader keeps the same hierarchy with more horizontal room.

#### Deeply nested content remains navigable after the inspector expands

The active item and jump behavior continue to work in the full-width view.

#### Long labels remain single-line and expose a full-text affordance

Single-line rhythm avoids unpredictable row heights in a long outline.

## Interaction notes

Selecting an outline item scrolls the Markdown body to the matching heading.

### Active state

The active section updates while the body scrolls.

#### Scrolling to the end should reveal the final heading in the contents rail

The active item must remain visible without manual outline scrolling.

#### Clicking an earlier heading should update the active item immediately

The temporary scroll lock prevents intermediate headings from taking over.

### Collapsed state

Collapsing the rail returns the space to the Markdown body.

#### The collapsed control remains easy to target and understand

Its accessible name changes from collapse to expand.

#### Expanding restores the same outline without losing the active location

State survives the width transition and the list remains scrollable.

## Implementation record

These headings form a deterministic 4 / 8 / 16 hierarchy for regression tests.

### Test coverage

The fixture has twenty-eight headings in total.

#### Sixteen fourth-level headings reproduce the reported density

This is the same deep-heading count described in the issue.

#### The size check verifies usable label width rather than only CSS values

Computed content width is asserted after the app renders the real component.

### Visual evidence

The test captures ordinary and expanded detail states.

#### Playwright saves both screenshots under the ignored release directory

The screenshots are reproducible without adding test noise to product docs.

#### The regression fails if deep labels become too narrow again

Width, indentation, nowrap, active visibility, and full labels are all checked.
