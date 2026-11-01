/**
 * Interaction grammar — ONE source for the tool-arm exclusivity rule
 * (round 5, PR #49 comment #6560170382).
 *
 * GRAMMAR RULE: selecting a tool DISARMS the glass. Arm is exclusive —
 * clicking any palette chip while the glass is armed deselects it.
 * One-directional as specified: re-arming the glass does NOT deselect the
 * chip (symmetry can be a follow-up).
 *
 * The armed state (magnifierOn) and the selected-tool state
 * (selectedPlantId / selectedStructureId) live in the placement store; this
 * module is the single decision point both the palette clicks and the store
 * actions consult, so the rule cannot diverge between input paths.
 */
export interface ArmState {
  magnifierOn: boolean;
}

/**
 * What selecting a palette entry must do to the glass. Returns true when the
 * glass must be disarmed (a tool was selected while the glass was armed).
 * Selecting null (deselecting a chip) never touches the glass.
 */
export function selectToolDisarmsGlass(arm: ArmState, toolId: string | null): boolean {
  return arm.magnifierOn && toolId !== null;
}
