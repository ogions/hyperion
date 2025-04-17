export class FountainRegexes {
    character = /^[^a-z()]*[A-Z]+[^a-z()]*(\(.*\))?$/;
    pageBreak = /^={3,}$/;
    parenthetical = /^\s*\(.*\)\s*$/;
    sceneHeading = /^(int|ext|est|int\.?\/ext|i\.?\/e)[\. ].+/i;
    forcedSceneHeading = /^\.[a-zA-Z0-9]/;
    sceneNumber = /#([^#]+)#\s*$/;
    sectionHeading = /^(#{1,6})/;
    titlePageKey = /^([^\s:][^:]*)(:\s*)(.*)$/;
    titlePageIndentedValue = /^( {3}\s*|\t\s*)(.*)/;
    transition = /^([^a-z]*TO:|FADE OUT.|CUT TO BLACK.|FADE TO BLACK.)$/;
}
