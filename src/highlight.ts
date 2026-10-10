/* ---------- syntax highlighting for the diff view ----------
   A small lexer per language family. It returns [start, end, class] ranges
   in UTF-16 offsets and never HTML: app.js escapes every piece of text and
   only uses class names from Syntax.CLASSES. A lexer keeps state from one
   line to the next (block comments, multi-line strings, open tags), so each
   side of a diff needs its own lexer. All regexes are sticky or anchored
   with no nested quantifiers, and very long lines are skipped, because file
   contents are untrusted input. */
/** [start, end, class] in UTF-16 offsets of one line. */
export type Token = [start: number, end: number, cls: string];
/** Lexes a file line by line, keeping state (open comments, strings, tags) between lines. */
export interface Lexer { line(s: string): Token[] }

interface StrSpec { ml?: boolean; esc?: string; dbl?: boolean }
/** One language family; flags switch on the extra rules `code()` knows. */
interface Lang {
  line: string[]; block?: [string, string][]; str: Record<string, StrSpec>; kw: Set<string>; lit: Set<string>;
  ty?: Set<string>; va?: Set<string>; ident?: RegExp; keyRe?: RegExp; section?: RegExp; vars?: string; deco?: string;
  ci?: boolean; css?: boolean; dashFn?: boolean; here?: boolean; ivar?: boolean; keys?: boolean; lineStart?: boolean;
  lineWs?: boolean; macro?: boolean; pre?: boolean; rust?: boolean; sym?: boolean; triple?: boolean; upper?: boolean; verbatim?: boolean;
}
/** An open string or comment that may run past the end of the line. */
interface Open { end: string; c: string; esc: string; dbl?: boolean }

export const Syntax = (() => {
  const MAX_LINE = 2000;
  const CLASSES = new Set(['cm', 'st', 'kw', 'lt', 'nu', 'ty', 'fn', 'at', 'pr', 'tg', 'va', 'hd']);
  const W = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
  const IDENT = /[A-Za-z_$À-￿][\w$À-￿]*/y;
  const NUM = /(?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)[a-zA-Z%]*/y;

  const C_STR: Record<string, StrSpec> = { '"': {}, "'": {} };
  const JS: Lang = {
    line: ['//'], block: [['/*', '*/']], str: { ...C_STR, '`': { ml: true } }, upper: true, deco: '@',
    kw: W(`break case catch class const continue debugger default delete do else export extends finally for from function if import in instanceof
      let new of return static super switch this throw try typeof var void while with yield async await as implements interface package private
      protected public type enum declare abstract readonly namespace module keyof infer is satisfies get set override accessor`),
    lit: W('true false null undefined NaN Infinity'),
    ty: W('string number boolean any unknown never object symbol bigint'),
  };
  const LANGS: Record<string, Lang> = {
    js: JS,
    json: { line: ['//'], block: [['/*', '*/']], str: { '"': {} }, keys: true, kw: W(''), lit: W('true false null') },
    cs: {
      line: ['//'], block: [['/*', '*/']], str: C_STR, triple: true, verbatim: true, pre: true, upper: true,
      kw: W(`abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit
        extern finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new object operator out override
        params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw try typeof
        uint ulong unchecked unsafe ushort using virtual void volatile while async await dynamic get set init value var when where yield record
        required with nameof partial global not and or file scoped`),
      lit: W('true false null'),
    },
    java: {
      line: ['//'], block: [['/*', '*/']], str: C_STR, triple: true, upper: true, deco: '@',
      kw: W(`abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for
        goto if implements import instanceof int interface long native new package private protected public return short static strictfp super
        switch synchronized this throw throws transient try void volatile while var record sealed permits yield fun val when object companion data
        inline suspend override open internal lateinit is in out by typealias init constructor`),
      lit: W('true false null'),
    },
    go: {
      line: ['//'], block: [['/*', '*/']], str: { ...C_STR, '`': { ml: true, esc: '' } }, upper: true,
      kw: W('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var'),
      lit: W('true false nil iota'),
      ty: W('bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr any'),
    },
    rust: {
      line: ['//'], block: [['/*', '*/']], str: { '"': { ml: true } }, rust: true, upper: true, macro: true,
      kw: W('as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while'),
      lit: W('true false None Some Ok Err'),
      ty: W('bool char str u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64'),
    },
    c: {
      line: ['//'], block: [['/*', '*/']], str: C_STR, pre: true,
      kw: W(`auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short
        signed sizeof static struct switch typedef union unsigned void volatile while class namespace template typename public private protected
        virtual override final new delete this throw try catch using operator friend explicit constexpr noexcept static_cast dynamic_cast
        reinterpret_cast const_cast decltype bool`),
      lit: W('true false NULL nullptr'),
    },
    py: {
      line: ['#'], str: C_STR, triple: true, upper: true, deco: '@',
      kw: W('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'),
      lit: W('True False None'), va: W('self cls'),
    },
    rb: {
      line: ['#'], lineWs: true, str: C_STR, upper: true, ivar: true, sym: true,
      kw: W('alias and begin break case class def do else elsif end ensure for if in module next not or redo rescue retry return self super then undef unless until when while yield require attr_accessor attr_reader'),
      lit: W('true false nil'),
    },
    php: {
      line: ['//', '#'], block: [['/*', '*/']], str: C_STR, vars: '$', ci: true, upper: true,
      kw: W(`abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty extends final
        finally fn for foreach function global goto if implements include include_once instanceof interface isset list match namespace new or
        print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield`),
      lit: W('true false null'),
    },
    sh: {
      line: ['#'], lineWs: true, str: { '"': { ml: true }, "'": { ml: true, esc: '' } }, vars: '$', ident: /[A-Za-z_][\w-]*/y,
      kw: W('if then else elif fi for while until do done case esac in function return local export readonly declare unset shift exit break continue select source alias'),
      lit: W('true false'),
    },
    ps: {
      line: ['#'], block: [['<#', '#>']], str: { '"': { ml: true, esc: '`', dbl: true }, "'": { ml: true, esc: '', dbl: true } }, here: true,
      vars: '$', ci: true, dashFn: true, ident: /-?[A-Za-z_][\w-]*/y,
      kw: W(`begin break catch class continue data do dynamicparam else elseif end enum exit filter finally for foreach function if in param process
        return switch throw trap try until using while -eq -ne -gt -ge -lt -le -like -notlike -match -notmatch -contains -notcontains -in -notin
        -and -or -not -xor -is -isnot -replace -split -join -f`),
      lit: W('true false null'),
    },
    sql: {
      line: ['--'], block: [['/*', '*/']], str: { "'": { esc: '', dbl: true, ml: true } }, vars: '@', ci: true,
      kw: W(`select from where and or not insert into values update set delete create table alter drop index view join inner left right outer full
        cross on as group by order having limit offset union all distinct case when then else end is null like in between exists primary key
        foreign references default constraint unique check begin commit rollback transaction declare exec execute procedure function returns
        return if while top with asc desc cascade database schema use go nocount output merge using matched over partition int varchar nvarchar
        char text date datetime datetime2 bit decimal numeric float bigint smallint uniqueidentifier`),
      lit: W('true false'),
    },
    css: {
      line: [], block: [['/*', '*/']], str: C_STR, css: true, vars: '$', ident: /(?:--|-)?[A-Za-z_][\w-]*/y,
      kw: W(''), lit: W(''),
    },
    yaml: {
      line: ['#'], lineWs: true, str: { '"': {}, "'": { esc: '', dbl: true } }, ci: true,
      keyRe: /^(\s*(?:- +)?)([^\s:#'"-][^:#]*|"[^"]*"|'[^']*'):(?=\s|$)/,
      kw: W(''), lit: W('true false null yes no on off ~'),
    },
    ini: {
      line: ['#', ';'], lineStart: true, str: { '"': {} }, triple: true,
      keyRe: /^(\s*)([^\s=:#;[][^=:]*)[=:]/, section: /^\s*\[[^\]]*\]/,
      kw: W(''), lit: W('true false'),
    },
    docker: {
      line: ['#'], lineStart: true, str: C_STR, vars: '$',
      kw: W('FROM RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL AS'),
      lit: W(''),
    },
    conf: { line: ['#'], lineStart: true, str: {}, kw: W(''), lit: W('') },
  };

  const EXT: Record<string, string> = {};
  const ext = (lang: string, list: string) => list.split(' ').forEach(e => { EXT[e] = lang; });
  ext('js', 'js mjs cjs jsx ts tsx mts cts');
  ext('json', 'json jsonc json5 code-workspace');
  ext('cs', 'cs csx');
  ext('java', 'java kt kts groovy gradle scala');
  ext('go', 'go');
  ext('rust', 'rs');
  ext('c', 'c h cc cpp cxx hh hpp hxx m mm');
  ext('py', 'py pyw pyi');
  ext('rb', 'rb rake gemspec');
  ext('php', 'php');
  ext('sh', 'sh bash zsh ksh');
  ext('ps', 'ps1 psm1 psd1');
  ext('sql', 'sql');
  ext('css', 'css scss less');
  ext('markup', 'html htm xhtml vue svelte xml svg xaml axaml csproj vbproj fsproj sqlproj props targets config nuspec resx plist cshtml razor');
  ext('yaml', 'yml yaml');
  ext('ini', 'toml ini cfg conf properties editorconfig env gitconfig');
  ext('md', 'md markdown');
  const NAMES: Record<string, string> = {
    dockerfile: 'docker', containerfile: 'docker', makefile: 'conf', '.gitignore': 'conf', '.gitattributes': 'conf',
    '.dockerignore': 'conf', '.npmrc': 'ini', '.editorconfig': 'ini', '.env': 'ini',
  };
  function lang(path: string): string | null{
    const name = String(path || '').split('/').pop()!.toLowerCase();
    const known = NAMES[name];
    if (known) return known;
    if (name.startsWith('.env.') || name.startsWith('dockerfile.')) return name.startsWith('.env.') ? 'ini' : 'docker';
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? EXT[name.slice(dot + 1)] || null : null;
  }

  // Index just past the end of an open string or comment, or -1 if it does not end on this line.
  function closeAt(s: string, i: number, st: Open){
    for (let k = i; k < s.length; k++) {
      if (st.esc && s[k] === st.esc) { k++; continue; }
      if (s.startsWith(st.end, k)) {
        if (st.dbl && s.startsWith(st.end, k + st.end.length)) { k += st.end.length * 2 - 1; continue; }
        return k + st.end.length;
      }
    }
    return -1;
  }
  const RUST_CHAR = /'(?:\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]{1,6}\}|.)|[^\\'\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff])'/y;
  const RUST_LIFE = /'[A-Za-z_]\w*/y;
  const WORD = /[\w.]+/y, VAR = /[A-Za-z_]\w*(?::[A-Za-z_]\w*)?/y, CSS_HEX = /#[\da-fA-F]{3,8}(?![\w-])/y, CSS_AT = /[#.]?[\w-]+/y;
  const at = (re: RegExp, s: string, i: number) => { re.lastIndex = i; const m = re.exec(s); return m ? m[0].length : 0; };

  function code(L: Lang): Lexer{
    const ident = L.ident || IDENT;
    let st: Open | null = null, depth = 0;
    return { line(s){
      const out: Token[] = [], n = s.length;
      const add = (a: number, b: number, c: string) => { if (b > a) out.push([a, b, c]); };
      if (n > MAX_LINE) { st = null; return out; }
      const first = s.search(/\S/);
      let i = 0;
      // Opens a string or comment at `from`; returns where scanning goes on (n while it stays open).
      const open = (from: number, skip: number, state: Open, ml?: boolean) => {
        st = state;
        const j = closeAt(s, from + skip, state);
        if (j < 0) { add(from, n, state.c); if (!ml) st = null; return n; }
        add(from, j, state.c); st = null;
        if (L.keys && state.c === 'st') {
          let k = j; while (s[k] === ' ' || s[k] === '\t') k++;
          if (s[k] === ':') out[out.length - 1]![2] = 'pr';   // the string just added
        }
        return j;
      };
      if (st) {
        const j = closeAt(s, 0, st);
        if (j < 0) { add(0, n, st.c); return out; }
        add(0, j, st.c); st = null; i = j;
      } else if (L.keyRe) {
        if (L.section && L.section.test(s)) { const m = s.match(L.section)!; add(m[0].length - m[0].trimStart().length, m[0].length, 'tg'); i = m[0].length; }
        else {
          // keyRe always has two groups: indent and key.
          const m = s.match(L.keyRe);
          if (m) { const a = m[1]!.length, key = m[2]!.trimEnd(); add(a, a + key.length, 'pr'); i = a + m[2]!.length; }
        }
      }
      while (i < n) {
        const c = s[i]!;
        if (c === ' ' || c === '\t') { i++; continue; }
        let hit = false;
        for (const lc of L.line) {
          if (s.startsWith(lc, i) && (!L.lineWs || i === 0 || s[i - 1] === ' ' || s[i - 1] === '\t') && (!L.lineStart || i === first)) { hit = true; break; }
        }
        if (hit) { add(i, n, 'cm'); return out; }
        const blk = L.block && L.block.find(b => s.startsWith(b[0], i));
        if (blk) { i = open(i, blk[0].length, { end: blk[1], c: 'cm', esc: '' }, true); continue; }
        if (L.pre && c === '#' && i === first) { add(i, n, 'kw'); return out; }
        if (L.triple && (s.startsWith('"""', i) || s.startsWith("'''", i))) { i = open(i, 3, { end: s.slice(i, i + 3), c: 'st', esc: L.verbatim ? '' : '\\' }, true); continue; }
        if (L.verbatim && c === '@' && s[i + 1] === '"') { i = open(i, 2, { end: '"', c: 'st', esc: '', dbl: true }, true); continue; }
        if (L.here && c === '@' && (s[i + 1] === '"' || s[i + 1] === "'")) { i = open(i, 2, { end: s[i + 1] + '@', c: 'st', esc: '' }, true); continue; }
        if (L.rust && c === "'") {
          let k = at(RUST_CHAR, s, i);
          if (k) { add(i, i + k, 'st'); i += k; continue; }
          k = at(RUST_LIFE, s, i);
          if (k) { add(i, i + k, 'at'); i += k; continue; }
          i++; continue;
        }
        if (L.rust && c === '#' && (s[i + 1] === '[' || (s[i + 1] === '!' && s[i + 2] === '['))) {
          const j = s.indexOf(']', i); const e = j < 0 ? n : j + 1;
          add(i, e, 'at'); i = e; continue;
        }
        const q = L.str[c];
        if (q) { i = open(i, 1, { end: c, c: 'st', esc: q.esc ?? '\\', dbl: q.dbl }, q.ml); continue; }
        if (L.vars && c === L.vars) {
          if (s[i + 1] === '{') { const j = s.indexOf('}', i); const e = j < 0 ? n : j + 1; add(i, e, 'va'); i = e; continue; }
          const k = at(VAR, s, i + 1);
          if (k) { add(i, i + 1 + k, L.lit.has(s.slice(i + 1, i + 1 + k).toLowerCase()) ? 'lt' : 'va'); i += 1 + k; continue; }
          if (L.vars === '$' && /[\d@?#$!*-]/.test(s[i + 1] || '')) { add(i, i + 2, 'va'); i += 2; continue; }
          i++; continue;
        }
        if (L.deco && c === L.deco) {
          const k = at(WORD, s, i + 1);
          if (k) { add(i, i + 1 + k, 'at'); i += 1 + k; continue; }
        }
        if (L.ivar && c === '@') { const p = s[i + 1] === '@' ? 2 : 1, k = at(WORD, s, i + p); if (k) { add(i, i + p + k, 'va'); i += p + k; continue; } }
        if (L.sym && c === ':' && s[i - 1] !== ':' && s[i + 1] !== ':') { const k = at(IDENT, s, i + 1); if (k) { add(i, i + 1 + k, 'lt'); i += 1 + k; continue; } }
        if (L.css) {
          if (c === '{') { depth++; i++; continue; }
          if (c === '}') { depth = Math.max(0, depth - 1); i++; continue; }
          if (c === '@') { const k = at(CSS_AT, s, i + 1); add(i, i + 1 + k, 'kw'); i += 1 + k; continue; }
          if (c === '!' && s.startsWith('important', i + 1)) { add(i, i + 10, 'kw'); i += 10; continue; }
          if (c === '#' && depth > 0) { const k = at(CSS_HEX, s, i); if (k) { add(i, i + k, 'nu'); i += k; continue; } }
          if ((c === '#' || c === '.') && /[A-Za-z_-]/.test(s[i + 1] || '')) { const k = at(CSS_AT, s, i); add(i, i + k, 'at'); i += k; continue; }
        }
        if (c >= '0' && c <= '9') { const k = at(NUM, s, i); add(i, i + k, 'nu'); i += k; continue; }
        const k = at(ident, s, i);
        if (k) {
          const w = s.slice(i, i + k), key = L.ci ? w.toLowerCase() : w, e = i + k;
          let cls: string | null = null;
          if (L.kw.has(key)) cls = 'kw';
          else if (L.lit.has(key)) cls = 'lt';
          else if (L.ty && L.ty.has(key)) cls = 'ty';
          else if (L.va && L.va.has(key)) cls = 'va';
          else {
            let j = e; while (s[j] === ' ' || s[j] === '\t') j++;
            const nx = s[j];
            if (L.css) cls = depth > 0 ? (nx === ':' ? 'pr' : nx === '(' ? 'fn' : null) : (s[i - 1] === ':' ? 'at' : 'tg');
            else if (nx === '(') cls = 'fn';
            else if (L.macro && nx === '!' && s[j + 1] !== '=') cls = 'fn';
            else if (L.dashFn && w.includes('-')) cls = w[0] === '-' ? 'at' : 'fn';
            else if (L.upper && w.charCodeAt(0) >= 65 && w.charCodeAt(0) <= 90 && /[a-z]/.test(w)) cls = 'ty';
          }
          if (cls) add(i, e, cls);
          i = e; continue;
        }
        i++;
      }
      return out;
    } };
  }

  const ATTR = /[^\s"'<>/=?]+/y, TAG = /<\/?[A-Za-z_][\w:.-]*/y, DECL = /<[!?][\w-]*/y, ENT = /&(?:#\d+|#x[\da-fA-F]+|\w+);/y;
  function markup(): Lexer{
    let st = 'text', q = '';
    return { line(s){
      const out: Token[] = [], n = s.length;
      const add = (a: number, b: number, c: string) => { if (b > a) out.push([a, b, c]); };
      if (n > MAX_LINE) { st = 'text'; return out; }
      // Closes `end` from i as class c; returns the next index, or n with the state left open.
      const until = (from: number, i: number, end: string, c: string, then: string) => {
        const j = s.indexOf(end, i);
        if (j < 0) { add(from, n, c); return n; }
        add(from, j + end.length, c); st = then; return j + end.length;
      };
      let i = 0;
      while (i < n) {
        if (st === 'cm') { i = until(i, i, '-->', 'cm', 'text'); continue; }
        if (st === 'cdata') { i = until(i, i, ']]>', 'st', 'text'); continue; }
        if (st === 'val') { i = until(i, i, q, 'st', 'tag'); continue; }
        const c = s[i]!;
        if (st === 'tag') {
          if (c === '>') { add(i, i + 1, 'tg'); i++; st = 'text'; continue; }
          if ((c === '/' || c === '?') && s[i + 1] === '>') { add(i, i + 2, 'tg'); i += 2; st = 'text'; continue; }
          if (c === '"' || c === "'") { q = c; st = 'val'; i = until(i, i + 1, q, 'st', 'tag'); continue; }
          const k = at(ATTR, s, i);
          if (k) { add(i, i + k, 'at'); i += k; } else i++;
          continue;
        }
        if (c !== '<' && c !== '&') { i++; continue; }
        if (c === '&') { const k = at(ENT, s, i); if (k) { add(i, i + k, 'lt'); i += k; } else i++; continue; }
        if (s.startsWith('<!--', i)) { st = 'cm'; i = until(i, i + 4, '-->', 'cm', 'text'); continue; }
        if (s.startsWith('<![CDATA[', i)) { st = 'cdata'; i = until(i, i + 9, ']]>', 'st', 'text'); continue; }
        const k = at(TAG, s, i) || at(DECL, s, i);
        if (k > 1) { add(i, i + k, 'tg'); i += k; st = 'tag'; continue; }
        i++;
      }
      return out;
    } };
  }

  const MD_HEAD = /^ {0,3}#{1,6}(?:\s|$)/, MD_FENCE = /^ {0,3}(`{3,}|~{3,})/, MD_LIST = /^\s*(?:[-*+]|\d+[.)])(?=\s)/, MD_QUOTE = /^ {0,3}>/;
  function markdown(): Lexer{
    let fence = '';
    return { line(s){
      const out: Token[] = [], n = s.length;
      const add = (a: number, b: number, c: string) => { if (b > a) out.push([a, b, c]); };
      if (n > MAX_LINE) return out;
      const f = s.match(MD_FENCE), mark = f && f[1]!;   // MD_FENCE has one group, the fence itself
      if (fence) {
        if (f && mark && mark[0] === fence[0] && mark.length >= fence.length && !s.slice(f[0].length).trim()) { add(0, n, 'cm'); fence = ''; }
        else add(0, n, 'st');
        return out;
      }
      if (f) { add(0, n, 'cm'); fence = mark!; return out; }
      if (MD_HEAD.test(s)) { add(0, n, 'hd'); return out; }
      if (MD_QUOTE.test(s)) { add(0, n, 'cm'); return out; }
      let i = 0;
      const li = s.match(MD_LIST);
      if (li) { add(li[0].length - li[0].trimStart().length, li[0].length, 'kw'); i = li[0].length; }
      while (i < n) {
        const c = s[i];
        if (c === '`') {
          let k = i; while (s[k] === '`') k++;
          const j = s.indexOf(s.slice(i, k), k);
          if (j < 0) { i = k; continue; }
          add(i, j + (k - i), 'st'); i = j + (k - i); continue;
        }
        if (c === ']' && s[i + 1] === '(') {
          const j = s.indexOf(')', i);
          if (j > 0) { add(i + 2, j, 'at'); i = j + 1; continue; }
        }
        if (s.startsWith('<!--', i)) { const j = s.indexOf('-->', i); const e = j < 0 ? n : j + 3; add(i, e, 'cm'); i = e; continue; }
        i++;
      }
      return out;
    } };
  }

  function lexer(name: string): Lexer | null{
    if (name === 'markup') return markup();
    if (name === 'md') return markdown();
    const L = LANGS[name];
    return L ? code(L) : null;
  }
  return { lang, lexer, CLASSES, MAX_LINE };
})();
