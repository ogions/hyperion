# Hyperion

Hyperion is a TypeScript module for parsing Fountain screenplay markup.

For a working implementation, see [Fairfax](https://github.com/ogions/monica). For more on Fountain, see [the website](https://fountain.io/). 

## Usage

Hyperion can take any Fountain string as input and will return a `Document` object (see [Documents](#documents) below).

```typescript
import { Parser } from "hyperion"

const parser = new Parser();
const fountainDocument = parser.parse(myFountainString);
```

However, Hyperion is an incremental parser, meaning it's also capable of processing a single line of input at an arbitrary position in the screenplay. Because Fountain is context-based, if we do this, then we also need to pass in a `ParserContext` with some extra information about the input.

```typescript
import { Parser, ParserContext } from "hyperion"

const parser = new Parser();
const context = new ParserContext(
    isDocumentStart,
    isInDialogue,
    isInDualDialogue,
    nextLineIsBlank,
    previousLineIsBlank
);

const fountainDocument = parser.parse(myPartialFountainString, context);
```

## Documents

Hyperion returns a `Document` object, which contains a few other elements that define a Fountain screenplay.

* `Document.titlePage` is a `Map` object of key/value pairs from the screenplay's title page. Note that this isn't the actual text of the title page, which is still contained in the document blocks, but a set of already-paired values for easy access.
* `Document.blocks` is an array of `Block` objects (see [Blocks](#blocks) below) that represents the full parsed content of the input.
* `Document.activeMultilines` and `Document.openMultilines` are collections of `MultilineStructures` (see [Multilines](#multilines) below). These allow an editor to handle multiline comments that might extend beyond the parsed section.

### Blocks

A `Block` has a type (like Action, Dialogue, or Transition) and some `Run`s. Each `Run` contains some raw text and a set of `RunStyle`s which define how the text should be displayed. See the following example of how a chunk of Fountain would be returned by Hyperion.

```
DAN
Let's retire them.
_Permanently_.
```

```typescript
[
    {
        type: Character,
        runs: [ { text: "DAN", styles: [] } ]
    },
    {
        type: Dialogue,
        runs: [ { text: "Let's retire them.", styles: [] } ]
    },
    {
        type: Dialogue,
        runs: [
            { text: "_", styles: [Markup] },
            { text: "Permanently", styles: [Underline] },
            { text: "_", styles: [Markup] },
            { text: ".", styles: [] }
        ]
    }
]
```

### Multilines

While Fountain is primarily a line-based language, it allows two kinds of multiline elements: boneyards and notes.

So that an editor can handle elements that extend outside of the input section, Hyperion sends back some information about these elements.

`MultilineStructure`s have a type, a start index, and an end index. `OpenMultilineStructure`s have a type, an index, and a boolean `forward` that marks whether the element opens forward or backward.

## Compatibility

Hyperion conforms to the [official Fountain spec](https://fountain.io/syntax). Where the spec is ambiguous, behavior is based on the [official source code](https://github.com/nyousefi/Fountain), [Highland](https://quoteunquoteapps.com/highland-pro/), and [CommonMark](https://commonmark.org/). Broadly, Hyperion aims to be generous and interpret markup as the user most likely intended.

## License

Hyperion is available under the MIT license. If you want to build an editor using Hyperion, consider starting with [Fairfax](https://github.com/ogions/monica) instead, a minimal implementation which is also MIT-licensed.

---

Zach Lo

https://zachlo.com
