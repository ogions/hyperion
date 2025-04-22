import { RunStyle } from "./blocks";
import { RunToken, RunTokenType, StyleToken } from "./tokens";

export class Stylizer {

    static styleMap = new Map([
        [RunTokenType.Bold, RunStyle.Bold],
        [RunTokenType.Italic, RunStyle.Italic],
        [RunTokenType.Underline, RunStyle.Underline],
        [RunTokenType.BoneyardOpen, RunStyle.Boneyard],
        [RunTokenType.BoneyardClose, RunStyle.Boneyard],
        [RunTokenType.NoteOpen, RunStyle.Note],
        [RunTokenType.NoteClose, RunStyle.Note]
    ]);
    activeStyles: Set<RunStyle> = new Set();

    stylize(token: RunToken): Set<RunStyle> {

        if (token instanceof StyleToken) {
            const styles = new Set(this.activeStyles).add(RunStyle.Special);
            this.process(token, styles);
            if (token.active) {
                return styles;
            }
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

        return new Set(this.activeStyles);
    }

    process(token: StyleToken, styles: Set<RunStyle>) {
        if (token.active) {
            const style = Stylizer.styleMap.get(token.type);
            if (style === undefined) return;
            if (this.activeStyles.has(style)) {
                this.activeStyles.delete(style);
                styles.delete(style);
            } else {
                this.activeStyles.add(style);
            }
        }
    }
}
