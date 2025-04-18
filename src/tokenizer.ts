import { Lexer } from "./lexer";
import { FountainRegexes } from "./regexes";
import { Token, TokenType } from "./tokens";

export class Tokenizer {
    regexes = new FountainRegexes();

    tokenizeLine(line: string, lexer: Lexer): Token {

        /*
         * Rules are derived from the official Fountain spec at https://fountain.io/syntax/.
         * I've noted any variations where they occurred, usually because the spec is vague
         * and/or canonical implementations (the Fountain Github repo or Highland) disagree.
         * When in doubt, I try to be permissive, so the parser doesn't feel too pedantic.
         *
         * Official Spec: https://fountain.io/syntax/
         * Github Repo: https://github.com/nyousefi/Fountain/
         */
        
        // Blank line
        if (!line) {
            return new Token(
                TokenType.BlankLine,
                line
            );
        }

        /*
         * The optional Title Page is always the first thing in a Fountain document.
         * Information is encoding in the format key: value. Keys can have spaces
         * (e. g. "Draft date"), but must end with a colon.
         *
         * Values can be inline with the key or they can be indented on a newline
         * below the key. Indenting is 3 or more spaces, or a tab. The indenting
         * pattern allows multiple values for the same key (multiple authors,
         * multiple address lines).
         */
        if (lexer.isInTitlePage) {
            if (this.regexes.titlePageKey.test(line)) {
                const matches = this.regexes.titlePageKey.exec(line);
                const key = matches ? matches[1] : "";
                const space = matches ? matches[2] : "";
                const value = matches ? matches[3] : "";

                const tokens = [
                    new Token(
                        TokenType.TitlePageKey,
                        key
                    ),
                    new Token (
                        TokenType.Text,
                        space
                    )
                ];

                if (value) {
                    tokens.push(new Token(
                        TokenType.TitlePageValue,
                        value
                    ));
                }

                return new Token(
                    TokenType.TitlePage,
                    tokens
                );
            } else {
                const matches = this.regexes.titlePageIndentedValue.exec(line);
                if (matches) {
                    const space = matches[1];
                    const value = matches[2];

                    const tokens = [
                        new Token(
                            TokenType.Text,
                            space
                        ),
                        new Token(
                            TokenType.TitlePageValue,
                            value
                        )
                    ];

                    return new Token(
                        TokenType.TitlePage,
                        tokens
                    );
                }
            }
            return new Token(
                TokenType.TitlePage,
                lexer.lexLine(line)
            );
        }

        /*
         * You create a Lyric by starting with a line with a tilde ~.
         * Fountain will remove the '~' and leave it up to the app to style the Lyric appropriately.
         * Lyrics are always forced. There is no "automatic" way to get them.
         */
        if (line.startsWith("~")) {
            const tokens = [
                new Token(
                    TokenType.LyricLeader,
                    "~"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new Token(
                TokenType.Lyric,
                tokens
            );
        }

        /*
         * You can force a Character element by preceding it with the “at” symbol @.
         *
         * The ability to force a Character element is helpful for names that require lower-case letters,
         * and for non-Roman languages.
         */
        if (line.startsWith("@")) {
            const tokens = [
                new Token(
                    TokenType.CharacterForce,
                    "@"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new Token(
                TokenType.Character,
                tokens
            );
        }

        /*
         * You can force any line to be a transition by beginning it with a greater-than symbol >.
         *
         * Centered text constitutes an Action element, and is bracketed with greater/less-than:
         * >THE END<
         * Leading spaces are usually preserved in Action, but not for centered text,
         * so you can add spaces between the text and the >< if you like.
         */
        if (line.startsWith(">")) {
            if (line.endsWith("<")) {
                const tokens = [
                    new Token(
                        TokenType.CenterLeft,
                        ">"
                    ),
                    ...lexer.lexLine(line.slice(1, -1)),
                    new Token(
                        TokenType.CenterRight,
                        "<"
                    )
                ];
                console.log("centered line")
                return new Token(
                    TokenType.Action,
                    tokens
                );
            }

            const tokens = [
                new Token(
                    TokenType.TransitionForce,
                    ">"
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new Token(
                TokenType.Transition,
                tokens
            );
        }

        /*
         * Page Breaks are indicated by a line containing three or more
         * consecutive equals signs, and nothing more.
         */
        if (this.regexes.pageBreak.test(line)) {
            return new Token(
                TokenType.PageBreak,
                line
            )
        }

        /*
         * Synopses are optional blocks of text to describe a Section or scene.
         * Synopses are single lines prefixed by an equals sign =.
         * They can be located anywhere within the screenplay.
         */
        if (line.startsWith("=")) {
            const tokens = [
                new Token(
                    TokenType.SynopsisLeader,
                    "="
                ),
                ...lexer.lexLine(line.slice(1))
            ];
            return new Token(
                TokenType.Synopsis,
                tokens
            );
        }

        /*
         * Sections are optional markers for managing the structure of a story.
         * Some screenplay applications use these like nested folders in a navigation view.
         * Create a Section by preceding a line with one or more pound-sign # characters.
         * You can nest Sections by adding more # characters.
         */
        if (this.regexes.sectionHeading.test(line)) {
            const result = this.regexes.sectionHeading.exec(line);
            const leader = result ? result[1] : "";
            const tokens = [
                new Token(
                    TokenType.SectionHeadingLeader,
                    leader
                ),
                ...lexer.lexLine(line.slice(leader.length))
            ];
            return new Token(
                TokenType.SectionHeading,
                tokens
            );
        }

        /*
         * A Scene Heading is any line that has a blank line following it,
         * and either begins with INT or EXT or similar (full list below).
         * A line beginning with any of the following, followed by either a dot or a space,
         * is considered a Scene Heading (unless the line is preceded by an exclamation point !).
         * Case insensitive.
         * INT, EXT, EST, INT/EXT, I/E
         * A Scene Heading always has at least one blank line preceding it.
         *
         * You can “force” a Scene Heading by starting the line with a single period.
         * Note that only a single leading period followed by an alphanumeric character
         * will force a Scene Heading. This allows the writer to begin Action and Dialogue elements
         * with ellipses without worry that they’ll be interpreted as Scene Headings.
         */
        if (this.regexes.forcedSceneHeading.test(line) ||
            (lexer.previousLineIsBlank &&
            lexer.nextLineIsBlank &&
            this.regexes.sceneHeading.test(line))) {

            const result = this.regexes.sceneNumber.exec(line);
            const sceneNumber = result ? result[1] : "";
            const endIndex = sceneNumber ? line.length - sceneNumber.length - 2 : line.length;
            const startIndex = this.regexes.forcedSceneHeading.test(line) ? 1 : 0;

            const sceneNumberTokens = sceneNumber ?
                [
                    new Token(
                        TokenType.SceneNumberFence,
                        "#"
                    ),
                    new Token(
                        TokenType.SceneNumber,
                        sceneNumber
                    ),
                    new Token(
                        TokenType.SceneNumberFence,
                        "#"
                    )
                ] :
                [];

            if (startIndex === 1) {
                const tokens = [
                    new Token(
                        TokenType.SceneHeadingForce,
                        "."
                    ),
                    ...lexer.lexLine(line.slice(startIndex, endIndex)),
                    ...sceneNumberTokens
                ];
                return new Token(
                    TokenType.SceneHeading,
                    tokens
                );
            } else {
                const tokens = [
                    ...lexer.lexLine(line.slice(startIndex,endIndex)),
                    ...sceneNumberTokens
                ];
                return new Token(
                    TokenType.SceneHeading,
                    tokens
                );
            }
        }

        /*
         * The requirements for Transition elements are:
         *   - Uppercase
         *   - Preceded by and followed by an empty line
         *   - Ending in TO:
         *
         * The Fountain implementation on Github provides exceptions for
         * "FADE OUT.", "CUT TO BLACK.", and "FADE TO BLACK."
         */
        if (lexer.previousLineIsBlank &&
            lexer.nextLineIsBlank &&
            this.regexes.transition.test(line)) {

            return new Token(
                TokenType.Transition,
                lexer.lexLine(line)
            );
        }

         /*
         * A Character element is any line entirely in uppercase, with one empty line
         * before it and without an empty line after it.
         * "Character Extensions" – the parenthetical notations that follow
         * a character name on the same line – may be in uppercase or lowercase.
         * Character names must include at least one alphabetical character.
         * "R2D2" works, but "23" does not.
         */
        if (lexer.previousLineIsBlank &&
            !lexer.nextLineIsBlank &&
            this.regexes.character.test(line)) {

            /*
             * Dual, or simultaneous, dialogue is expressed by adding a caret ^
             * after the second Character element.
             * Any number of spaces between the Character name and the caret are acceptable,
             * and will be ignored. All that matters is that
             * the caret is the last character on the line.
             */
            if (line.endsWith("^")) {
                const tokens = [
                    new Token(
                        TokenType.DualDialogue,
                        "^"
                    ),
                    ...lexer.lexLine(line.slice(-1))
                ];
                return new Token(
                    TokenType.Character,
                    tokens
                );
            }

            return new Token(
                TokenType.Character,
                lexer.lexLine(line)
            );
        }

        /*
         * Dialogue is any text following a Character or Parenthetical element.
         * Parentheticals follow a Character or Dialogue element,
         * and are wrapped in parentheses ().
         * If you want to do the unconventional thing of leaving white space in dialogue,
         * you would need to type two spaces on your “blank” line.
         */
        if (lexer.isInDialogue) {
            if (this.regexes.parenthetical.test(line)) {
                return new Token(
                    TokenType.Parenthetical,
                    lexer.lexLine(line)
                );
            }

            return new Token(
                TokenType.Dialogue,
                lexer.lexLine(line)
            );
        }

        // Fall back on action
        return new Token(
            TokenType.Action,
            lexer.lexLine(line)
        );
    }

    tokenizeChar(char: string, lexer: Lexer): Token {
        
        // If the character is escaped, we ignore it.
        if (lexer.isEscaped) {
            return new Token(
                TokenType.Text,
                char
            )
        }

        // Check for two-character patterns first.
        if (lexer.nextChar === "*") {
            if (char === "/") {
                return new Token(
                    TokenType.BoneyardOpen,
                    "/*"
                );
            }
            if (char === "*") {
                return new Token(
                    TokenType.Bold,
                    "**"
                );
            }
        }
        if (char === "*" && lexer.nextChar === "/") {
            return new Token(
                TokenType.BoneyardClose,
                "*/"
            );
        }
        if (char === "[" && lexer.nextChar === "[") {
            return new Token(
                TokenType.NoteOpen,
                "[["
            );
        }
        if (char === "]" && lexer.nextChar === "]") {
            return new Token(
                TokenType.NoteClose,
                "]]"
            );
        }

        // Next we can check for single-character patterns.
        if (char === "*") {
            return new Token(
                TokenType.Italic,
                "*"
            );
        }
        if (char === "_") {
            return new Token(
                TokenType.Underline,
                "_"
            );
        }

        // Fall back on plain text
        return new Token(
            TokenType.Text,
            char
        )
    }

}
