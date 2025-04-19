import { BlockToken, BlockTokenType, RunToken, RunTokenType, StyleToken } from "./tokens";
import { Tokenizer } from "./tokenizer";

export class LexerOptions {

    isDocumentStart: boolean;
    isInDialogue: boolean;
    nextLineIsBlank: boolean;
    previousLineIsBlank: boolean;

    constructor(
        isDocumentStart: boolean,
        isInDialogue: boolean,
        nextLineIsBlank: boolean,
        previousLineIsBlank: boolean
    ) {
        this.isDocumentStart = isDocumentStart;
        this.isInDialogue = isInDialogue;
        this.nextLineIsBlank = nextLineIsBlank;
        this.previousLineIsBlank = previousLineIsBlank;
    }
}

export class Lexer {

    // Block-level flags
    isDocumentStart = false;
    isInDialogue = false;
    nextLineIsBlank = true;
    previousLineIsBlank = true;

    // Inline flags
    isEscaped = false;
    nextChar = "";

    openBoneyards: StyleToken[] = [];
    openNotes: StyleToken[] = [];
    openInlines: StyleToken[] = [];
    textBuffer = "";
    tokenizer = new Tokenizer();

    lex(chunk: string, options: LexerOptions): BlockToken[] {

        this.isDocumentStart = options.isDocumentStart;
        this.isInDialogue = options.isInDialogue;
        this.previousLineIsBlank = options.previousLineIsBlank;

        const lines = chunk.split("\n");
        const tokens = [];
        this.openBoneyards = [];
        this.openNotes = [];
        this.openInlines = [];

        /* 
         * If there's a title page at the start of the document, we use a
         * separate function to process that first.
         */
        if (this.isDocumentStart && Tokenizer.regexes.titlePageKey.test(lines[0])) {
            this.isDocumentStart = false;
            for (let i = 0; i < lines.length; i++) {
                const token = this.tokenizer.tokenizeTitlePage(lines[i], this);
                if (
                    token.type === BlockTokenType.BlankLine ||
                    token.type === BlockTokenType.PageBreak
                ) {
                    this.previousLineIsBlank = true;
                    this.isInDialogue = false;
                    break;
                }
                tokens.push(token);
            }
        }

        for (let i = tokens.length; i < lines.length; i++) {
            if (i < lines.length - 1) {
                const nextLine = lines[i + 1];
                this.nextLineIsBlank = !nextLine;
            } else {
                this.nextLineIsBlank = options.nextLineIsBlank;
            }

            const token = this.tokenizer.tokenizeLine(lines[i], this);

            if (token.type === BlockTokenType.BlankLine ||
                token.type === BlockTokenType.PageBreak) {
                this.previousLineIsBlank = true;
                this.isInDialogue = false;
            } else if (token.type === BlockTokenType.Character) {
                this.isInDialogue = true;
                this.previousLineIsBlank = false;
            } else {
                this.previousLineIsBlank = false;
            }
            
            tokens.push(token);
        }
        return tokens;
    }

    lexLine(line: string): RunToken[] {

        const tokens = [];

        for (let i = 0; i < line.length; i++) {
            if (i < line.length - 1) {
                this.nextChar = line[i + 1];
            } else {
                this.nextChar = "";
            }

            const token = this.tokenizer.tokenizeChar(line[i], this);

            // First, handle escape tokens or reset the escaped flag.
            this.isEscaped = (token.type === RunTokenType.Escape);

            /* 
             * Then we open or activate paired style tokens. Note that no pairs
             * can cross boneyard boundaries, nor can inline pairs cross note
             * boundaries. Because of this, we clear open stacks on entering
             * and leaving those structures.
             */
            if (token instanceof StyleToken) {
                if (token.type === RunTokenType.BoneyardOpen) {
                    this.openBoneyards.push(token as StyleToken);
                    this.openNotes = [];
                    this.openInlines = [];
                }
                if (token.type === RunTokenType.BoneyardClose) {
                    const openToken = this.openBoneyards.pop();
                    if (openToken) openToken.active = true;
                    token.active = true;
                    this.openNotes = [];
                    this.openInlines = [];
                }
                if (token.type === RunTokenType.NoteOpen) {
                    this.openNotes.push(token as StyleToken);
                    this.openInlines = [];
                }
                if (token.type === RunTokenType.NoteClose) {
                    const openToken = this.openNotes.pop();
                    if (openToken) openToken.active = true;
                    token.active = true;
                    this.openInlines = [];
                }
                if (
                    token.type === RunTokenType.Bold ||
                    token.type === RunTokenType.Italic ||
                    token.type === RunTokenType.Underline
                ) {
                    for (let i = this.openInlines.length - 1; i >= 0; i++) {
                        const openToken = this.openInlines[i] as StyleToken;
                        if (openToken.type === token.type) {
                            this.openInlines.splice(i, 1);
                            openToken.active = true;
                            token.active = true;
                            break;
                        }
                    }
                    if (!token.active) this.openInlines.push(token);
                }
            }

            // If the token is plain text, we start/continue building a text buffer.
            if (token.type === RunTokenType.Text) {
                this.textBuffer += token.content;
            } else {
                // Otherwise, we push and clear the text buffer.
                if (this.textBuffer.length > 0) {
                    tokens.push(new RunToken(
                        RunTokenType.Text,
                        this.textBuffer
                    ));
                    this.textBuffer = "";
                }

                // If we processed a two-character token, we skip the next character.
                if (token.content.length === 2) i++;

                tokens.push(token);
            }
        }
        // Push any leftover buffer text at the end.
        if (this.textBuffer.length > 0) {
            tokens.push(new RunToken(
                RunTokenType.Text,
                this.textBuffer
            ));
            this.textBuffer = "";
        }
        return tokens;
    }
}
