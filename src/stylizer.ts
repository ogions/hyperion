import { Block, Run, RunStyle } from "./blocks";
import { Token, TokenType } from "./tokens";

export class Stylizer {

    styleMap = new Map([
        [TokenType.CenterLeft, RunStyle.Centered],
        [TokenType.CenterRight, RunStyle.Centered],
        [TokenType.Bold, RunStyle.Bold],
        [TokenType.Italic, RunStyle.Italic],
        [TokenType.Underline, RunStyle.Underline],
        [TokenType.BoneyardOpen, RunStyle.Boneyard],
        [TokenType.BoneyardClose, RunStyle.Boneyard],
        [TokenType.NoteOpen, RunStyle.Note],
        [TokenType.NoteClose, RunStyle.Note]
    ]);
    closerTokens = new Set([
        TokenType.CenterRight,
        TokenType.Bold,
        TokenType.Italic,
        TokenType.Underline,
        TokenType.BoneyardClose,
        TokenType.NoteClose
    ]);
    openerTokens = new Set([
        TokenType.CenterLeft,
        TokenType.Bold,
        TokenType.Italic,
        TokenType.Underline,
        TokenType.BoneyardOpen,
        TokenType.NoteOpen
    ]);
    openStyles = new Set();
    openStyleStarts = new Map();

    stylize(token: Token, runs: Run[], tokenIndex: number): Set<RunStyle> {

        // Standalone tokens can just be returned as special runs.
        if (token.type === TokenType.SceneHeadingForce ||
            token.type === TokenType.SceneNumberFence ||
            token.type === TokenType.ActionForce ||
            token.type === TokenType.CharacterForce ||
            token.type === TokenType.LyricLeader ||
            token.type === TokenType.TransitionForce ||
            token.type === TokenType.SectionHeadingLeader ||
            token.type === TokenType.SynopsisLeader) {

            return new Set([RunStyle.Special]);
        }

        // Plain text can be returned without any styles.
        if (token.type === TokenType.Text) {
            return new Set();
        }

        // All other tokens need to be checked for pairs.
        return this.handleStyle(token, runs, tokenIndex);
    }

    reset() {
        this.openStyles = new Set();
        this.openStyleStarts = new Map();
    }

    handleStyle(token: Token, runs: Run[], tokenIndex: number): Set<RunStyle> {

        const style = this.styleMap.get(token.type);
        if (typeof style === "undefined") return new Set();

        /* Check if the token closes an open style. We need to make sure that
         * the token is a potential closer and that the style it closes has
         * already been opened.
         */
        if (this.closerTokens.has(token.type) &&
            this.openStyles.has(style)) {
            
            this.closeStyle(style, runs, tokenIndex);
            return new Set([RunStyle.Special]);
        }

        // Otherwise, as long as the token is an opener, we open a new style.
        if (this.openerTokens.has(token.type)) {
            this.openStyle(style, tokenIndex);
        }

        /* Open tokens are not given a special style, since we don't yet know if
         * they will be closed. The special style is assigned later when the run
         * is closed.
         */
        return new Set();
    }

    openStyle(style: RunStyle, tokenIndex: number) {
        this.openStyles.add(style);
        if (!this.openStyleStarts.has(style)) {
            this.openStyleStarts.set(style, tokenIndex + 1);
        }
    }

    closeStyle(style: RunStyle, runs: Run[], tokenIndex: number) {
        const startIndex = this.openStyleStarts.get(style);
        runs[startIndex - 1].styles.add(RunStyle.Special);

        for (let i = startIndex; i < tokenIndex; i++) {
            runs[i].styles.add(style);
        } 

        this.openStyles.delete(style);
    }
}
