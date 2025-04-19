import { Run, RunStyle } from "./blocks";
import { MultilineManager } from "./multiline";
import { RunToken, RunTokenType, StyleToken } from "./tokens";

export class Stylizer {

    static styleMap = new Map([
        [RunTokenType.Bold, RunStyle.Bold],
        [RunTokenType.Italic, RunStyle.Italic],
        [RunTokenType.Underline, RunStyle.Underline],
        [RunTokenType.BoneyardOpen, RunStyle.Boneyard],
        [RunTokenType.NoteOpen, RunStyle.Note],
    ]);
    activeStyles: Set<RunStyle> = new Set();
    mlManager: MultilineManager;

    constructor(mlManager: MultilineManager) {
        this.mlManager = mlManager;
    }

    stylize(token: RunToken): Set<RunStyle> {

        if (token instanceof StyleToken) {
            this.process(token);
            return new Set([RunStyle.Special]);
        }

        if (token.type === RunTokenType.SceneHeadingForce ||
            token.type === RunTokenType.SceneNumberFence ||
            token.type === RunTokenType.ActionForce ||
            token.type === RunTokenType.CharacterForce ||
            token.type === RunTokenType.DualDialogue ||
            token.type === RunTokenType.LyricLeader ||
            token.type === RunTokenType.TransitionForce ||
            token.type === RunTokenType.SectionHeadingLeader ||
            token.type === RunTokenType.SynopsisLeader) {

            return new Set([RunStyle.Special]);
        }

        if (token.type === RunTokenType.TitlePageKey) {
            return new Set([RunStyle.TitlePageKey]);
        }

        return this.activeStyles;
    }

    process(token: StyleToken) {
        if (token.active) {
            const style = Stylizer.styleMap.get(token.type);
            if (style === undefined) return;
            if (this.activeStyles.has(style)) {
                this.activeStyles.delete(style);
            } else {
                this.activeStyles.add(style);
            }
        }
    }

    isMultiline(token: StyleToken) {
        return (
            token.type === RunTokenType.BoneyardOpen ||
            token.type === RunTokenType.BoneyardClose ||
            token.type === RunTokenType.NoteOpen ||
            token.type === RunTokenType.NoteClose
        );
    }
}
