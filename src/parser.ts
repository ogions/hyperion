import { Block, BlockType, Document, Run, RunStyle } from "./blocks";
import { Lexer, LexerContext } from "./lexer";
import { MultilineManager } from "./multiline";
import { Stylizer } from "./stylizer";
import { BlockToken, BlockTokenType, RunToken, RunTokenType, StyleToken } from "./tokens";

export class ParserContext {
    isDocumentStart: boolean;
    isInDialogue: boolean;
    isInDualDialogue: boolean;
    nextLineIsBlank: boolean;
    previousLineIsBlank: boolean;

    constructor(
        isDocumentStart?: boolean,
        isInDialogue?: boolean,
        isInDualDialogue?: boolean,
        nextLineIsBlank?: boolean,
        previousLineIsBlank?: boolean,
    ) {
        this.isDocumentStart = isDocumentStart ?? false;
        this.isInDialogue = isInDialogue ?? false;
        this.isInDualDialogue = isInDualDialogue ?? false;
        this.nextLineIsBlank = nextLineIsBlank ?? true;
        this.previousLineIsBlank = previousLineIsBlank ?? true;
    }
}

export class Parser {

    static typeMap = new Map([
        [BlockTokenType.BlankLine, BlockType.BlankLine],
        [BlockTokenType.SceneHeading, BlockType.SceneHeading],
        [BlockTokenType.Action, BlockType.Action],
        [BlockTokenType.Character, BlockType.Character],
        [BlockTokenType.Dialogue, BlockType.Dialogue],
        [BlockTokenType.Parenthetical, BlockType.Parenthetical],
        [BlockTokenType.Lyric, BlockType.Lyric],
        [BlockTokenType.Transition, BlockType.Transition],
        [BlockTokenType.PageBreak, BlockType.PageBreak],
        [BlockTokenType.SectionHeading, BlockType.SectionHeading],
        [BlockTokenType.Synopsis, BlockType.Synopsis],
        [BlockTokenType.TitlePage, BlockType.TitlePage]
    ]);

    lexer = new Lexer();
    mlManager = new MultilineManager();
    stylizer = new Stylizer();

    activeStyles = new Set();
    openTitlePageKey = "";
    openTitlePageValue: string[] = [];
    isInBoneyard = false;
    isInDualDialogue = false;
    isInNote = false;

    parse(chunk: string, context?: ParserContext): Document {
        if (!context) context = new ParserContext();
        const lexerContext = new LexerContext(
            context.isDocumentStart,
            context.isInDialogue,
            context.nextLineIsBlank,
            context.previousLineIsBlank
        );
        this.isInDualDialogue = context.isInDualDialogue;

        const tokens = this.lexer.lex(chunk, lexerContext);

        const titlePage = new Map();
        const blocks = [];
        this.mlManager.reset();

        /* 
         * If we're at the start of the document, read the title page into a map.
         * Note that this doesn't do any inline parsing or read the tokens into
         * blocks; that happens in the main document parse. This just builds the
         * map for later reference.
         */
        if (context.isDocumentStart) {
            for (let [i, token] of tokens.entries()) {
                if (token.type === BlockTokenType.TitlePage) {
                    this.parseTitlePageBlock(token.content, titlePage);
                    this.mlManager.openTitlePage();
                } else {
                    if (this.mlManager.hasOpenTitlePage) {
                        this.mlManager.closeTitlePage(i);
                    }
                    break;
                }
            }
            /* 
             * If there are any open title page items left when we finish parsing,
             * we add them to the title page and close the open items.
             */
            if (this.openTitlePageKey) {
                titlePage.set(this.openTitlePageKey, this.openTitlePageValue.join("\n"));
                this.openTitlePageKey = "";
                this.openTitlePageValue = [];
            }
            if (this.mlManager.hasOpenTitlePage) {
                this.mlManager.closeTitlePage(tokens.length - 1);
            }
        }

        /*
         * We need to handle multiline structures now because they may break
         * inline styles. Similarly, boneyards can break notes, so we need to
         * handle those completely first.
         */
        this.parseBoneyards();
        this.parseNotes();
        
        for (let [i, token] of tokens.entries()) {
            this.parseInlines(token.content);

            // Unlike boneyards, notes can't contain any block-level styles.
            const blockType = this.isInNote ?
                BlockType.Action :
                (Parser.typeMap.get(token.type) ?? BlockType.Action)

            if (blockType === BlockType.BlankLine) this.isInDualDialogue = false;

            /* 
             * Then all tokens (including title page tokens) are parsed for
             * inline styles and multiline structures.
             */
            const runs = this.parseBlock(token, i);

            blocks.push(new Block(
                blockType,
                runs,
                token.centered,
                this.isInDualDialogue
            ));
        }

        return new Document(
            titlePage,
            blocks,
            this.mlManager.activeMultilines,
            this.mlManager.openMultilines
        );
    }

    parseBlock(blockToken: BlockToken | RunToken, lineIndex: number): Run[] {
        const runs = [];

        /*
         * We need to handle both block tokens and nested run tokens. The
         * latter should only occur in title page values.
         */
        if (blockToken instanceof BlockToken) {
            for (let token of blockToken.content) {
                /* 
                 * If the token is a title page value, then we need to iterate
                 * over its nested values and return those concatenated with
                 * the runs we've collected so far.
                 *
                 * If it's not a title page value, then it should only have a
                 * string as content, so we continue if that's not the case.
                 */
                if (token.type === RunTokenType.TitlePageValue) {
                    return [...runs, ...this.parseBlock(token, lineIndex)]; 
                }
                if (typeof token.content !== "string") continue;

                /*
                 * Handle any special cases, like flagging dual dialogue and
                 * processing multilines.
                 */
                if (token.type === RunTokenType.DualDialogue) {
                    this.isInDualDialogue = true;
                }
                if (token.isMultilineStyle()) {
                    this.mlManager.manage(token as StyleToken, lineIndex);
                }

                // Stylize the token and store it as a run.
                const text = token.content;
                const styles = this.stylizer.stylize(token, blockToken.allowsInlineStyles());
                runs.push(new Run(text, styles));
            }
        } else {
            /*
             *  A RunToken should only enter this function if it contains other
             *  RunTokens (that is, if it's a title page value). If it isn't
             *  nested for some reason, there's been a problem and we return an
             *  empty array.
             */
            if (typeof blockToken.content === "string") return [];

            /*
             * From there, we can do a slightly modified version of the above
             * parse. We don't have to worry about dual dialogue, but we still
             * need to track multilines. We also only add the "TitlePageValue"
             * run style to plain text to avoid overriding other styles.
             */
            this.parseInlines(blockToken.content);
            for (let token of blockToken.content) {
                if (typeof token.content !== "string") continue;
                if (token.isMultilineStyle()) {
                    this.mlManager.manage(token as StyleToken, lineIndex);
                }
                const text = token.content;
                const styles = this.stylizer.stylize(token);
                if (!(
                    styles.has(RunStyle.Boneyard) ||
                    styles.has(RunStyle.Note) ||
                    styles.has(RunStyle.Special)
                )) {
                    styles.add(RunStyle.TitlePageValue);
                }
                runs.push(new Run(text, styles));
            }
        }
        return runs;
    }

    parseTitlePageBlock(tokens: RunToken[], titlePage: Map<string, string>) {
        for (let token of tokens) {
            if (token.type === RunTokenType.TitlePageKey) {
                const text = typeof token.content === "string" ? token.content : "";
                if (this.openTitlePageKey && this.openTitlePageValue) {
                    titlePage.set(this.openTitlePageKey, this.openTitlePageValue.join("\n"));
                }
                this.openTitlePageKey = text;
                this.openTitlePageValue = [];
            } else if (token.type === RunTokenType.TitlePageValue) {
                if (typeof token.content !== "object") return;
                const value = token.content.map((t) => t.content).join("");
                this.openTitlePageValue.push(value);
            }
        }
    }

    parseBoneyards() {
        let openBoneyard;
        for (let token of this.lexer.multilineTokens) {
            if (token.type === RunTokenType.BoneyardOpen) {
                openBoneyard = token;
            } else if (token.type === RunTokenType.BoneyardClose) {
                if (openBoneyard) {
                    openBoneyard.active = true;
                    token.active = true;
                    openBoneyard = undefined;
                }
            }
        }
    }

    parseNotes() {
        let openNote;
        let isInBoneyard = false;
        for (let token of this.lexer.multilineTokens) {
            // Notes aren't allowed inside boneyards.
            if (token.active) {
                if (token.type === RunTokenType.BoneyardOpen) isInBoneyard = true;
                if (token.type === RunTokenType.BoneyardClose) isInBoneyard = false;
            }
            if (isInBoneyard) continue;

            if (token.type === RunTokenType.NoteOpen) {
                openNote = token;
            } else if (token.type === RunTokenType.NoteClose) {
                if (openNote) {
                    openNote.active = true;
                    token.active = true;
                    openNote = undefined;
                }
            }
        }
    }

    parseInlines(tokens: RunToken[]) {
        const openInlines = [];
        for (let token of tokens) {
            if (!(token instanceof StyleToken)) continue;
            // Inline styles aren't allowed inside notes.
            if (token.active) {
                if (token.type === RunTokenType.NoteOpen) this.isInNote = true;
                if (token.type === RunTokenType.NoteClose) this.isInNote = false;
            }
            if (this.isInNote) continue;
           
            /*
             * We look back for a matching token to activate. If we don't find
             * one, we store it as open.
             */
            if (
                token.type === RunTokenType.Bold ||
                token.type === RunTokenType.Italic ||
                token.type === RunTokenType.Underline
            ) {
                for (let i = openInlines.length - 1; i >= 0; i--) {
                    const openInline = openInlines[i];
                    if (token.type === openInline.type) {
                        openInline.active = true;
                        token.active = true;
                        openInlines.splice(i, 1);
                        break;
                    }
                }
                if (!token.active) openInlines.push(token);
            }
        }
    }
}
