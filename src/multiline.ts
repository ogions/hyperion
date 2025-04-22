import { RunTokenType, StyleToken } from "./tokens";

export enum MultilineType {
    Boneyard,
    Note,
    TitlePage
}

export class MultilineStructure {
    type: MultilineType;
    start: number;
    end: number;

    constructor(type: MultilineType, start: number, end: number) {
        this.type = type;
        this.start = start;
        this.end = end;
    }
}

export class OpenMultilineStructure {
    type: MultilineType;
    index: number;
    forward: boolean;

    constructor(type: MultilineType, index: number, forward: boolean) {
        this.type = type;
        this.index = index;
        this.forward = forward;
    } 

    closeAt(index: number): MultilineStructure {
        const start = this.forward ? this.index : index;
        const end = this.forward ? index : this.index;
        return new MultilineStructure(
            this.type,
            start,
            end
        );
    }
}


export class MultilineManager {

    static multilineTypes = new Map([
        [RunTokenType.BoneyardOpen, MultilineType.Boneyard],
        [RunTokenType.BoneyardClose, MultilineType.Boneyard],
        [RunTokenType.NoteOpen, MultilineType.Note],
        [RunTokenType.NoteClose, MultilineType.Note],
    ]);
    openMultilines: OpenMultilineStructure[] = [];
    activeMultilines: Set<MultilineStructure> = new Set();
    hasOpenTitlePage = false;

    reset() {
        this.openMultilines = [];
        this.activeMultilines = new Set();
    }

    manage(token: StyleToken, index: number) {
        const type = MultilineManager.multilineTypes.get(token.type);
        if (type === undefined) return;
        if (token.active) {
            if (token.isOpener()) {
                this.openMultilines.push(new OpenMultilineStructure(
                    type,
                    index,
                    true
                ));
            }
            /*
             * If the token is a closer, we iterate backwards over open
             * multilines and try to find a matching opener. Otherwise, we store
             * it as an open closer (could be closed by an opener later).
             *
             * Crystal clear, right?
             */
            if (token.isCloser()) {
                for (let i = this.openMultilines.length - 1; i >= 0; i--) {
                    const openMultiline = this.openMultilines[i];
                    if (type === openMultiline.type) {
                        const closedStructure = openMultiline.closeAt(index);
                        this.openMultilines.splice(i, 1);
                        this.activeMultilines.add(closedStructure);
                        break;
                    }
                }
            }
        } else {
            this.openMultilines.push(new OpenMultilineStructure(
                type,
                index,
                token.isOpener()
            ));
        }
    }

    openTitlePage() {
        this.hasOpenTitlePage = true;
    }

    closeTitlePage(index: number) {
        this.hasOpenTitlePage = false;
        this.activeMultilines.add(new MultilineStructure(
            MultilineType.TitlePage,
            0,
            index
        ));
    }


}
