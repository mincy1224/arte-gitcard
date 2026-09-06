"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/identity.js"(exports2) {
    "use strict";
    var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
    var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
    var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
    var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
    var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
    var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
    var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
    exports2.ALIAS = ALIAS;
    exports2.DOC = DOC;
    exports2.MAP = MAP;
    exports2.NODE_TYPE = NODE_TYPE;
    exports2.PAIR = PAIR;
    exports2.SCALAR = SCALAR;
    exports2.SEQ = SEQ;
    exports2.hasAnchor = hasAnchor;
    exports2.isAlias = isAlias;
    exports2.isCollection = isCollection;
    exports2.isDocument = isDocument;
    exports2.isMap = isMap;
    exports2.isNode = isNode;
    exports2.isPair = isPair;
    exports2.isScalar = isScalar;
    exports2.isSeq = isSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/visit.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path22) {
      const ctrl = callVisitor(key, node, visitor, path22);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path22, ctrl);
        return visit_(key, ctrl, visitor, path22);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path22 = Object.freeze(path22.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path22);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path22 = Object.freeze(path22.concat(node));
          const ck = visit_("key", node.key, visitor, path22);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path22);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path22) {
      const ctrl = await callVisitor(key, node, visitor, path22);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path22, ctrl);
        return visitAsync_(key, ctrl, visitor, path22);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path22 = Object.freeze(path22.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path22);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path22 = Object.freeze(path22.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path22);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path22);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path22) {
      if (typeof visitor === "function")
        return visitor(key, node, path22);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path22);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path22);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path22);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path22);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path22);
      return void 0;
    }
    function replaceNode(key, path22, node) {
      const parent = path22[path22.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports2.visit = visit;
    exports2.visitAsync = visitAsync;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/directives.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid2 = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid2);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports2.Directives = Directives;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/anchors.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports2.anchorIsValid = anchorIsValid;
    exports2.anchorNames = anchorNames;
    exports2.createNodeAnchors = createNodeAnchors;
    exports2.findNewAnchor = findNewAnchor;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/applyReviver.js"(exports2) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports2.applyReviver = applyReviver;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/toJS.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports2.toJS = toJS;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Node.js"(exports2) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports2.NodeBase = NodeBase;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Alias.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports2.Alias = Alias;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar.PLAIN = "PLAIN";
    Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports2.Scalar = Scalar;
    exports2.isScalarValue = isScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/createNode.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports2.createNode = createNode;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Collection.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path22, value) {
      let v = value;
      for (let i = path22.length - 1; i >= 0; --i) {
        const k = path22[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path22) => path22 == null || typeof path22 === "object" && !!path22[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path22, value) {
        if (isEmptyPath(path22))
          this.add(value);
        else {
          const [key, ...rest] = path22;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path22) {
        const [key, ...rest] = path22;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path22, keepScalar) {
        const [key, ...rest] = path22;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path22) {
        const [key, ...rest] = path22;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path22, value) {
        const [key, ...rest] = path22;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports2.Collection = Collection;
    exports2.collectionFromPath = collectionFromPath;
    exports2.isEmptyPath = isEmptyPath;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyComment.js"(exports2) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports2.indentComment = indentComment;
    exports2.lineComment = lineComment;
    exports2.stringifyComment = stringifyComment;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/foldFlowLines.js"(exports2) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports2.FOLD_BLOCK = FOLD_BLOCK;
    exports2.FOLD_FLOW = FOLD_FLOW;
    exports2.FOLD_QUOTED = FOLD_QUOTED;
    exports2.foldFlowLines = foldFlowLines;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyString.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar.Scalar.BLOCK_FOLDED:
          case Scalar.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar.Scalar.PLAIN:
            return plainString(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports2.stringifyString = stringifyString;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringify.js"(exports2) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports2.createStringifyContext = createStringifyContext;
    exports2.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyPair.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports2.stringifyPair = stringifyPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/log.js"(exports2) {
    "use strict";
    var node_process = require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports2.debug = debug;
    exports2.warn = warn;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports2.addMergeToJSMap = addMergeToJSMap;
    exports2.isMergeKey = isMergeKey;
    exports2.merge = merge;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports2) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports2.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/Pair.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports2.Pair = Pair;
    exports2.createPair = createPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyCollection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items.length; ++i) {
        const item = items[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports2.stringifyCollection = stringifyCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLMap.js"(exports2) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    function findPair(items, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports2.YAMLMap = YAMLMap;
    exports2.findPair = findPair;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/map.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports2.map = map;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/nodes/YAMLSeq.js"(exports2) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports2.YAMLSeq = YAMLSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/seq.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports2.seq = seq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/string.js"(exports2) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports2.string = string;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/common/null.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports2.nullTag = nullTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports2.boolTag = boolTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyNumber.js"(exports2) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports2.stringifyNumber = stringifyNumber;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/core/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports2.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/json/schema.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports2.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports2) {
    "use strict";
    var node_buffer = require("buffer");
    var Scalar = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
        if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports2.binary = binary;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports2.createPairs = createPairs;
    exports2.pairs = pairs;
    exports2.resolvePairs = resolvePairs;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports2.YAMLOMap = YAMLOMap;
    exports2.omap = omap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar.Scalar(false),
      stringify: boolStringify
    };
    exports2.falseTag = falseTag;
    exports2.trueTag = trueTag;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports2.float = float;
    exports2.floatExp = floatExp;
    exports2.floatNaN = floatNaN;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports2.int = int;
    exports2.intBin = intBin;
    exports2.intHex = intHex;
    exports2.intOct = intOct;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports2.YAMLSet = YAMLSet;
    exports2.set = set;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports2) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports2.floatTime = floatTime;
    exports2.intTime = intTime;
    exports2.timestamp = timestamp;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports2.schema = schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/tags.js"(exports2) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports2.coreKnownTags = coreKnownTags;
    exports2.getTags = getTags;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/schema/Schema.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports2.Schema = Schema;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/stringify/stringifyDocument.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports2.stringifyDocument = stringifyDocument;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/doc/Document.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path22, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path22, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path22) {
        if (Collection.isEmptyPath(path22)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path22) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path22, keepScalar) {
        if (Collection.isEmptyPath(path22))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path22, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path22) {
        if (Collection.isEmptyPath(path22))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path22) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path22, value) {
        if (Collection.isEmptyPath(path22)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path22), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path22, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports2.Document = Document;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/errors.js"(exports2) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports2.YAMLError = YAMLError;
    exports2.YAMLParseError = YAMLParseError;
    exports2.YAMLWarning = YAMLWarning;
    exports2.prettifyError = prettifyError;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-props.js"(exports2) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports2.resolveProps = resolveProps;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-contains-newline.js"(exports2) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports2.containsNewline = containsNewline;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports2) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports2.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-map-includes.js"(exports2) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items.some((pair) => isEqual(pair.key, search));
    }
    exports2.mapIncludes = mapIncludes;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-map.js"(exports2) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports2.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-seq.js"(exports2) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports2.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-end.js"(exports2) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports2.resolveEnd = resolveEnd;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap = fc.start.source === "{";
      const fcName = isMap ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports2.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-collection.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports2.composeCollection = composeCollection;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports2.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports2) {
    "use strict";
    var Scalar = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports2.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-scalar.js"(exports2) {
    "use strict";
    var identity = require_identity();
    var Scalar = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports2.composeScalar = composeScalar;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports2) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports2.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-node.js"(exports2) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports2.composeEmptyNode = composeEmptyNode;
    exports2.composeNode = composeNode;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/compose-doc.js"(exports2) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports2.composeDoc = composeDoc;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/compose/composer.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports2.Composer = Composer;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-scalar.js"(exports2) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports2.createScalarToken = createScalarToken;
    exports2.resolveAsScalar = resolveAsScalar;
    exports2.setScalarValue = setScalarValue;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-stringify.js"(exports2) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports2.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst-visit.js"(exports2) {
    "use strict";
    var BREAK = /* @__PURE__ */ Symbol("break visit");
    var SKIP = /* @__PURE__ */ Symbol("skip children");
    var REMOVE = /* @__PURE__ */ Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path22) => {
      let item = cst;
      for (const [field, index] of path22) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path22) => {
      const parent = visit.itemAtPath(cst, path22.slice(0, -1));
      const field = path22[path22.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path22, item, visitor) {
      let ctrl = visitor(item, path22);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path22.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path22);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path22) : ctrl;
    }
    exports2.visit = visit;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/cst.js"(exports2) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports2.createScalarToken = cstScalar.createScalarToken;
    exports2.resolveAsScalar = cstScalar.resolveAsScalar;
    exports2.setScalarValue = cstScalar.setScalarValue;
    exports2.stringify = cstStringify.stringify;
    exports2.visit = cstVisit.visit;
    exports2.BOM = BOM;
    exports2.DOCUMENT = DOCUMENT;
    exports2.FLOW_END = FLOW_END;
    exports2.SCALAR = SCALAR;
    exports2.isCollection = isCollection;
    exports2.isScalar = isScalar;
    exports2.prettyToken = prettyToken;
    exports2.tokenType = tokenType;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/lexer.js"(exports2) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports2.Lexer = Lexer;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/line-counter.js"(exports2) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports2.LineCounter = LineCounter;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/parse/parser.js"(exports2) {
    "use strict";
    var node_process = require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports2.Parser = Parser;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/public-api.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports2.parse = parse;
    exports2.parseAllDocuments = parseAllDocuments;
    exports2.parseDocument = parseDocument;
    exports2.stringify = stringify;
  }
});

// node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js"(exports2) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports2.Composer = composer.Composer;
    exports2.Document = Document.Document;
    exports2.Schema = Schema.Schema;
    exports2.YAMLError = errors.YAMLError;
    exports2.YAMLParseError = errors.YAMLParseError;
    exports2.YAMLWarning = errors.YAMLWarning;
    exports2.Alias = Alias.Alias;
    exports2.isAlias = identity.isAlias;
    exports2.isCollection = identity.isCollection;
    exports2.isDocument = identity.isDocument;
    exports2.isMap = identity.isMap;
    exports2.isNode = identity.isNode;
    exports2.isPair = identity.isPair;
    exports2.isScalar = identity.isScalar;
    exports2.isSeq = identity.isSeq;
    exports2.Pair = Pair.Pair;
    exports2.Scalar = Scalar.Scalar;
    exports2.YAMLMap = YAMLMap.YAMLMap;
    exports2.YAMLSeq = YAMLSeq.YAMLSeq;
    exports2.CST = cst;
    exports2.Lexer = lexer.Lexer;
    exports2.LineCounter = lineCounter.LineCounter;
    exports2.Parser = parser.Parser;
    exports2.parse = publicApi.parse;
    exports2.parseAllDocuments = publicApi.parseAllDocuments;
    exports2.parseDocument = publicApi.parseDocument;
    exports2.stringify = publicApi.stringify;
    exports2.visit = visit.visit;
    exports2.visitAsync = visit.visitAsync;
  }
});

// src/ci/runtime.ts
var import_node_child_process3 = require("child_process");
var import_node_fs19 = require("fs");
var import_node_os2 = require("os");
var import_node_path21 = __toESM(require("path"));

// src/config/load.ts
var import_node_fs7 = require("fs");
var import_yaml = __toESM(require_dist());

// src/config/paths.ts
var import_node_fs = require("fs");
var import_node_path = __toESM(require("path"));
var CONFIG_FILENAME = "arte-gitcard.yml";
function projectRootOf(configPath) {
  return import_node_path.default.dirname(configPath);
}
function resolveFromProject(projectRoot, p) {
  return import_node_path.default.isAbsolute(p) ? p : import_node_path.default.resolve(projectRoot, p);
}

// src/config/registry.ts
var import_node_path3 = __toESM(require("path"));

// src/config/root.ts
var import_node_fs2 = require("fs");
var import_node_path2 = __toESM(require("path"));
function isRootedOrAbsolute(value) {
  if (value.startsWith("/") || value.startsWith("\\")) return true;
  if (/^[A-Za-z]:/.test(value)) return true;
  return false;
}
function normalizeStructureRoot(raw, projectRoot) {
  let r = (raw ?? "").trim();
  if (r === "" || r === ".") return null;
  r = r.replace(/^\.\//, "").replace(/\/+$/, "");
  if (r === "") return null;
  if (isRootedOrAbsolute(r)) {
    throw new Error(`structure.root must be a project-relative directory, got absolute path "${raw}"`);
  }
  const parts = r.split(/[\\/]+/);
  if (parts.includes("..")) {
    throw new Error(`structure.root must not escape the project root, got "${raw}"`);
  }
  let cur = projectRoot;
  for (const part of parts) {
    cur = import_node_path2.default.join(cur, part);
    let st;
    try {
      st = (0, import_node_fs2.lstatSync)(cur);
    } catch {
      break;
    }
    if (st.isSymbolicLink()) {
      throw new Error(
        `structure.root "${raw}" traverses a symbolic link at "${cur}" \u2014 the visual tree root must not leave the repository`
      );
    }
  }
  const abs = import_node_path2.default.resolve(projectRoot, ...parts);
  if (!(0, import_node_fs2.existsSync)(abs)) {
    throw new Error(`structure.root "${raw}" does not exist (resolved to ${abs})`);
  }
  if (!(0, import_node_fs2.statSync)(abs).isDirectory()) {
    throw new Error(`structure.root "${raw}" is not a directory (resolved to ${abs})`);
  }
  return parts.join("/");
}
function assertOutputDirInside(projectRoot, directory) {
  if (isRootedOrAbsolute(directory)) {
    throw new Error(`output.directory "${directory}" must be inside the project root`);
  }
  const abs = import_node_path2.default.resolve(projectRoot, directory);
  const rel = import_node_path2.default.relative(projectRoot, abs);
  if (rel === "") {
    throw new Error(
      `output.directory "${directory}" must not be the project root itself (breaks output self-exclusion)`
    );
  }
  if (rel.startsWith("..") || import_node_path2.default.isAbsolute(rel)) {
    throw new Error(`output.directory "${directory}" must be inside the project root`);
  }
  let cur = projectRoot;
  for (const part of rel.split(/[\\/]+/)) {
    cur = import_node_path2.default.join(cur, part);
    let st;
    try {
      st = (0, import_node_fs2.lstatSync)(cur);
    } catch {
      return;
    }
    if (st.isSymbolicLink()) {
      throw new Error(
        `output.directory "${directory}" traverses a symbolic link at "${cur}" \u2014 output must not leave the project root`
      );
    }
  }
}

// src/display/template/policy.ts
var SVG_NS = "http://www.w3.org/2000/svg";
var SVG_ELEMENTS = /* @__PURE__ */ new Set([
  "svg",
  "g",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "clipPath",
  "mask",
  "title",
  "desc"
]);
var EVENT_ATTR_RE = /^on/i;
var ATTR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
var FRAGMENT_RE = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
var URL_ATTRS = /* @__PURE__ */ new Set(["href", "xlink:href", "xlinkHref"]);
var FORBIDDEN_PROTOCOLS = /* @__PURE__ */ new Set([
  "http",
  "https",
  "javascript",
  "file",
  "data",
  "vbscript",
  "blob",
  "ftp"
]);
function isForbiddenScheme(text) {
  const schemeMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(text.trim());
  if (!schemeMatch) return false;
  return FORBIDDEN_PROTOCOLS.has(schemeMatch[0].slice(0, -1).toLowerCase());
}
function assertAllowedElement(tag) {
  if (!SVG_ELEMENTS.has(tag)) {
    throw new Error(`template policy: element <${tag}> is not allowed in a safe Display SVG`);
  }
}
function assertSafeAttribute(tag, name, value) {
  assertAllowedElement(tag);
  if (!ATTR_NAME_RE.test(name)) {
    throw new Error(`template policy: attribute name "${name}" is not a safe XML name`);
  }
  if (EVENT_ATTR_RE.test(name)) {
    throw new Error(`template policy: event attribute "${name}" is forbidden`);
  }
  if (name === "style") {
    throw new Error('template policy: the "style" attribute is forbidden in safe Display templates');
  }
  if (name === "xmlns") {
    if (value !== SVG_NS) {
      throw new Error("template policy: xmlns must be the canonical SVG namespace (framework-owned)");
    }
    return;
  }
  if (URL_ATTRS.has(name)) {
    if (!value.startsWith("#")) {
      throw new Error(`template policy: ${name} must be a local "#fragment", got "${name}=${value}"`);
    }
    if (!FRAGMENT_RE.test(value.slice(1))) {
      throw new Error(`template policy: ${name} fragment is not a safe local name`);
    }
    return;
  }
  for (const m of value.matchAll(/url\(\s*([^)]*)\s*\)/g)) {
    const inner = m[1].trim();
    if (inner.startsWith("#")) {
      if (FRAGMENT_RE.test(inner.slice(1))) continue;
      throw new Error(`template policy: url() fragment "${inner}" is not a safe local name`);
    }
    throw new Error(`template policy: url() must reference a LOCAL fragment, got "${inner}"`);
  }
  if (isForbiddenScheme(value)) {
    throw new Error(`template policy: forbidden URL scheme in attribute ${name}`);
  }
  if (value.includes("//")) {
    throw new Error(`template policy: protocol-relative "//" is not allowed in attribute ${name}`);
  }
}
function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// src/display/template/runtime.ts
function renderSvg(root) {
  return (Array.isArray(root) ? root : [root]).map(renderNode).join("");
}
function renderNode(node) {
  if (node === null || node === void 0 || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    return escapeText(String(node));
  }
  const { tag, props, children } = node;
  assertAllowedElement(tag);
  const names = Object.keys(props).sort();
  let attrs = "";
  for (const name of names) {
    const value = props[name];
    if (value === void 0) continue;
    const text = typeof value === "number" ? String(value) : value;
    assertSafeAttribute(tag, name, text);
    attrs += ` ${name}="${escapeAttr(text)}"`;
  }
  const inner = children.map(renderNode).join("");
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

// src/util/readonly.ts
function deepCloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// src/display/definition.ts
function freezeConfig(config) {
  const canonical = deepCloneJson(config.defaults());
  return Object.freeze({
    ...config,
    defaults: () => deepCloneJson(canonical),
    settings: Object.freeze(config.settings.map((s) => Object.freeze({ ...s })))
  });
}
function freezeDefinition(definition) {
  return Object.freeze({
    id: definition.id,
    title: definition.title,
    config: freezeConfig(definition.config),
    render: Object.freeze({ ...definition.render })
  });
}
function defineLegacySvgDisplay(definition) {
  return freezeDefinition({
    id: definition.id,
    title: definition.title,
    config: definition.config,
    render: Object.freeze({ kind: "legacy-string", template: definition.template })
  });
}
function prepareSvgRoot(node) {
  if (!node || typeof node !== "object" || node.tag !== "svg") {
    throw new Error("template policy: a safe Display template must return exactly one root <svg> node");
  }
  return { ...node, props: { ...node.props, xmlns: SVG_NS } };
}
function displayArtifactContent(definition, ctx) {
  const render = definition.render;
  if (render.kind === "legacy-string") return render.template(ctx);
  return renderSvg(prepareSvgRoot(render.template(ctx)));
}
function persistedCardSliceOf(config, id) {
  return config.cards[id];
}
function resolveDisplayConfig(config, definition) {
  const persisted = config.cards[definition.id];
  if (persisted !== void 0) return persisted;
  return freshDisplayDefaults(definition);
}
function freshDisplayDefaults(definition) {
  return deepCloneJson(definition.config.defaults());
}
function displayEnabledIn(config, id) {
  const slice = config.cards[id];
  return slice?.enabled === true;
}
function ensureDisplayCardSlice(config, definition) {
  const existing = config.cards[definition.id];
  if (existing !== void 0) return existing;
  const created = freshDisplayDefaults(definition);
  config.cards[definition.id] = created;
  return created;
}

// src/config/registry.ts
var ConfigSetError = class extends Error {
};
function fail(msg) {
  throw new ConfigSetError(msg);
}
function noSet(message) {
  return () => fail(message);
}
function noReset() {
  return () => fail("this key is lifecycle-managed; use its dedicated command");
}
var GLOBAL_CONFIG_KEYS = [
  {
    key: "theme",
    kind: "lifecycle",
    type: "string",
    description: "Selected theme (installed YAML path)",
    managedBy: "arte-gitcard theme select",
    read: (c) => c.theme,
    apply: noSet("theme is managed by `arte-gitcard theme select`"),
    reset: noReset()
  },
  {
    key: "auto-update",
    kind: "lifecycle",
    type: "boolean",
    description: "GitHub auto-update",
    managedBy: "arte-gitcard github enable/disable",
    read: (c) => c["auto-update"],
    apply: noSet("auto-update is managed by `arte-gitcard github enable` / `arte-gitcard github disable`"),
    reset: noReset()
  },
  {
    key: "output.directory",
    kind: "tuning",
    type: "safe-relative-path",
    description: "Card output directory (project-relative)",
    read: (c) => c.output.directory,
    apply: (c, raw, env) => {
      assertOutputDirInside(env.projectRoot, raw);
      const abs = resolveFromProject(env.projectRoot, raw);
      const rel = import_node_path3.default.relative(env.projectRoot, abs).replace(/\\/g, "/");
      c.output.directory = rel;
    },
    reset: (c) => {
      c.output.directory = ".github/arte-git-card";
    }
  }
];
function displayKeys(d) {
  const keys = [];
  keys.push({
    key: `${d.id}.enabled`,
    kind: "lifecycle",
    type: "boolean",
    description: `${d.title} card enabled`,
    managedBy: "arte-gitcard add/remove",
    read: (c) => displayEnabledIn(c, d.id),
    apply: noSet(`${d.id}.enabled is managed by \`arte-gitcard add ${d.id}\` / \`arte-gitcard remove ${d.id}\``),
    reset: noReset()
  });
  for (const setting of d.config.settings) {
    keys.push({
      key: `${d.id}.${setting.key}`,
      kind: "tuning",
      type: setting.type,
      description: setting.description,
      read: (c) => setting.read(resolveDisplayConfig(c, d)),
      // apply materializes an absent optional display first so a `config set`
      // never auto-enables a card.
      apply: (c, raw) => {
        setting.apply(ensureDisplayCardSlice(c, d), raw);
      },
      // reset: absent optional block is a no-op (already at default), else resets in place.
      reset: (c) => {
        const persisted = persistedCardSliceOf(c, d.id);
        if (persisted !== void 0) setting.reset(persisted);
      }
    });
  }
  return keys;
}
function composeConfigKeys(displays) {
  const keys = [];
  for (const d of displays) keys.push(...displayKeys(d));
  keys.push(...GLOBAL_CONFIG_KEYS);
  return keys;
}

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el2 = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el2] = curr[el2] || { _errors: [] };
            } else {
              curr[el2] = curr[el2] || { _errors: [] };
              curr[el2]._errors.push(mapper(issue));
            }
            curr = curr[el2];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path22, errorMaps, issueData } = params;
  const fullPath = [...path22, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path22, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path22;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r3) => {
          if (!r3) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// src/config/schema.ts
var activityDaysSchema = external_exports.union([external_exports.literal(7), external_exports.literal(14), external_exports.literal(30)]);
var languageCommentSchema = external_exports.object({
  line: external_exports.array(external_exports.string().min(1)).optional(),
  block: external_exports.array(external_exports.tuple([external_exports.string().min(1), external_exports.string().min(1)])).optional()
}).strict();
var languageRuleSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  extensions: external_exports.array(external_exports.string()).optional(),
  filenames: external_exports.array(external_exports.string()).optional(),
  shebang: external_exports.array(external_exports.string()).optional(),
  comments: languageCommentSchema.optional()
}).strict();
var arteGitCardConfigSchema = external_exports.object({
  cards: external_exports.object({
    codebase: external_exports.object({
      enabled: external_exports.boolean(),
      languages: external_exports.object({ include_comments: external_exports.boolean() }).strict()
    }).strict(),
    structure: external_exports.object({
      enabled: external_exports.boolean(),
      root: external_exports.string(),
      max_depth: external_exports.number().int().min(1).max(20),
      activity_days: activityDaysSchema,
      commits: external_exports.object({ enabled: external_exports.boolean() }).strict(),
      changes: external_exports.object({ enabled: external_exports.boolean() }).strict()
    }).strict()
  }).strict(),
  languages: external_exports.array(languageRuleSchema).optional(),
  exclude: external_exports.array(external_exports.string()).optional(),
  theme: external_exports.string(),
  output: external_exports.object({ directory: external_exports.string() }).strict()
}).strict();

// src/config/v2.ts
function buildV2Schema(displays) {
  const cardsShape = {};
  for (const display of displays) {
    cardsShape[display.id] = display.config.requiredInSchemaV2 ? display.config.schema : display.config.schema.optional();
  }
  const schema = external_exports.object({
    "schema-version": external_exports.literal(2),
    cards: external_exports.object(cardsShape).strict(),
    languages: external_exports.array(languageRuleSchema).optional(),
    exclude: external_exports.array(external_exports.string()).optional(),
    theme: external_exports.string(),
    output: external_exports.object({ directory: external_exports.string() }).strict(),
    "auto-update": external_exports.boolean()
  }).strict();
  return schema;
}

// src/display/settings.ts
var DisplaySettingError = class extends Error {
};
function fail2(message) {
  throw new DisplaySettingError(message);
}
function parseBool(raw, label) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fail2(`${label} expects a boolean (true|false), got "${raw}"`);
}
function parseIntegerRange(raw, min, max, label) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    return fail2(`${label} expects an integer in ${min}..${max}, got "${raw}"`);
  }
  return n;
}
function parseEnumValue(raw, values, label) {
  const hit = values.find((v) => String(v) === raw);
  if (hit === void 0) {
    return fail2(`${label} expects one of ${values.join("|")}, got "${raw}"`);
  }
  return hit;
}

// src/statistics/definition.ts
function defineStatistic(definition) {
  return Object.freeze(definition);
}

// src/statistics/session.ts
var DEFAULT_BODY = "@default";
var PARAM_PREFIX = "P:";
function canonicalParams(params) {
  const seen = /* @__PURE__ */ new WeakSet();
  const enc = (value) => {
    if (value === null) return ["null"];
    const t = typeof value;
    switch (t) {
      case "boolean":
        return ["bool", value];
      case "number": {
        if (!Number.isFinite(value)) {
          throw new Error("unsupported (NaN/Infinity)");
        }
        return ["num", Object.is(value, -0) ? "-0" : String(value)];
      }
      case "string":
        return ["str", value];
      case "undefined":
        throw new Error("unsupported (undefined)");
      case "bigint":
        throw new Error("unsupported (bigint)");
      case "symbol":
        throw new Error("unsupported (symbol)");
      case "function":
        throw new Error("unsupported (function)");
      default:
        break;
    }
    if (value === null || typeof value !== "object") throw new Error(`unsupported (${t})`);
    const obj = value;
    if (obj instanceof Date) throw new Error("unsupported (Date)");
    if (obj instanceof Map) throw new Error("unsupported (Map)");
    if (obj instanceof Set) throw new Error("unsupported (Set)");
    if (seen.has(obj)) throw new Error("unsupported (circular)");
    seen.add(obj);
    try {
      if (Array.isArray(obj)) return encodeArray(obj);
      const proto = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error("unsupported (non-plain object)");
      }
      return encodeObject(obj, proto);
    } finally {
      seen.delete(obj);
    }
  };
  const encodeArray = (arr) => {
    const len = arr.length;
    for (let i = 0; i < len; i++) {
      if (!(i in arr)) throw new Error("unsupported (sparse array)");
    }
    for (const k of Reflect.ownKeys(arr)) {
      if (k === "length") continue;
      const ks = typeof k === "string" ? k : "";
      if (!/^(?:0|[1-9]\d*)$/.test(ks) || Number(ks) >= len) {
        throw new Error("unsupported (array extra/non-index/symbol property)");
      }
      const desc = Object.getOwnPropertyDescriptor(arr, ks);
      if (!desc) throw new Error("unsupported (array element without descriptor)");
      if (desc.get || desc.set) throw new Error("unsupported (accessor array element)");
      if (!desc.enumerable) throw new Error("unsupported (non-enumerable array element)");
    }
    const out = new Array(len);
    for (let i = 0; i < len; i++) out[i] = enc(arr[i]);
    return out;
  };
  const encodeObject = (obj, proto) => {
    const entries = [];
    for (const k of Reflect.ownKeys(obj)) {
      if (typeof k !== "string") throw new Error("unsupported (symbol key)");
      const desc = Object.getOwnPropertyDescriptor(obj, k);
      if (!desc) throw new Error("unsupported (property without descriptor)");
      if (desc.get || desc.set) throw new Error("unsupported (accessor property)");
      if (!desc.enumerable) throw new Error("unsupported (non-enumerable property)");
      entries.push([k, desc]);
    }
    entries.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    const protoTag = proto === null ? "null-proto" : "object-proto";
    return ["obj", protoTag, entries.map(([k, desc]) => [k, enc(desc.value)])];
  };
  try {
    return JSON.stringify(enc(params));
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unsupported value";
    throw new Error(
      `statistics: params could not be canonicalized deterministically (${reason}) \u2014 supported values are null/boolean/finite-number/string/arrays/plain objects. Define StatisticDefinition.cacheKey for this parameter type.`
    );
  }
}
function paramBody(definition, params) {
  if (params === void 0) return DEFAULT_BODY;
  const body = definition.cacheKey ? definition.cacheKey(params) : canonicalParams(params);
  return PARAM_PREFIX + body;
}
var StatisticsSession = class {
  env;
  instant;
  /** Per-definition-object cache: definition → canonicalParamBody → value. */
  cache = /* @__PURE__ */ new Map();
  /** Per-definition-object cycle stack (param bodies currently computing). */
  computing = /* @__PURE__ */ new Map();
  constructor(env) {
    this.env = env;
    this.instant = env.now.getTime();
  }
  get(definition, params) {
    const body = paramBody(definition, params);
    const key = definition;
    let byParams = this.cache.get(key);
    if (!byParams) {
      byParams = /* @__PURE__ */ new Map();
      this.cache.set(key, byParams);
    }
    if (byParams.has(body)) return byParams.get(body);
    const stack = this.computing.get(key) ?? [];
    if (stack.includes(body)) {
      throw new Error(`statistic cycle detected: "${definition.id}" (${body}) depends on itself`);
    }
    stack.push(body);
    this.computing.set(key, stack);
    try {
      const value = definition.compute(this.context(), params);
      byParams.set(body, value);
      return value;
    } finally {
      stack.pop();
      if (stack.length === 0) this.computing.delete(key);
    }
  }
  context() {
    return {
      projectRoot: this.env.projectRoot,
      now: new Date(this.instant),
      // fresh Date per compute call
      outputDirRel: this.env.outputDirRel,
      exclude: this.env.exclude,
      activityDirs: this.env.activityDirs,
      registry: this.env.registry,
      statistics: this
    };
  }
};
function createStatisticsSession(env) {
  return new StatisticsSession(env);
}

// src/scanner/index.ts
var import_node_path5 = __toESM(require("path"));
var import_node_fs4 = require("fs");

// src/scanner/exclude.ts
var HARD_EXCLUDED_DIRS = [".git", ".arte-git-card"];
var BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".svg",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".tgz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".flac",
  ".ogg",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".o",
  ".a",
  ".pyc",
  ".pyo",
  ".class",
  ".jar",
  ".war",
  ".min",
  ".lock"
]);
function matchesExcludeEntry(relativePosix, entry) {
  if (!entry) return false;
  const segments = relativePosix.split("/");
  const base = segments[segments.length - 1] ?? "";
  if (entry.startsWith("*.")) {
    return base.endsWith(entry.slice(1));
  }
  return segments.includes(entry) || relativePosix === entry || relativePosix.startsWith(`${entry}/`);
}
function underOutputDir(relativePosix, dirs) {
  if (!dirs) return false;
  return dirs.some((d) => d && (relativePosix === d || relativePosix.startsWith(`${d}/`)));
}
function isExcludedFile(relativePosix, opts = {}) {
  const segments = relativePosix.split("/");
  if (segments.some((seg) => HARD_EXCLUDED_DIRS.includes(seg))) return true;
  if (relativePosix === "arte-git-card.yml" || relativePosix === "arte-gitcard.yml") return true;
  if (relativePosix === ".github/workflows/arte-gitcard.yml") return true;
  if (underOutputDir(relativePosix, opts.outputDirs)) return true;
  const base = segments[segments.length - 1] ?? "";
  const lower = base.toLowerCase();
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx >= 0 && BINARY_EXTENSIONS.has(lower.slice(dotIdx))) return true;
  if (opts.exclude && opts.exclude.some((e) => matchesExcludeEntry(relativePosix, e))) return true;
  return false;
}
function isExcludedDir(relativeDirPosix, opts = {}) {
  const segments = relativeDirPosix.split("/");
  if (segments.some((seg) => HARD_EXCLUDED_DIRS.includes(seg))) return true;
  if (opts.exclude && opts.exclude.some((e) => e && segments.includes(e))) return true;
  if (underOutputDir(relativeDirPosix, opts.outputDirs)) return true;
  return false;
}

// src/scanner/files.ts
var import_node_fs3 = require("fs");
var import_node_path4 = __toESM(require("path"));
function walkFilesystem(root, opts = {}) {
  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = (0, import_node_fs3.readdirSync)(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const childAbs = import_node_path4.default.join(dir, entry.name);
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (isExcludedDir(childRel, opts)) continue;
        walk(childAbs, childRel);
      } else if (entry.isFile()) {
        if (isExcludedFile(childRel, opts)) continue;
        out.push({ absolutePath: childAbs, relative: childRel });
      }
    }
  };
  walk(root, "");
  return out;
}

// src/scanner/git.ts
var import_node_child_process = require("child_process");
function isGitRepo(root) {
  try {
    (0, import_node_child_process.execFileSync)("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: ["ignore", "ignore", "ignore"] });
    return true;
  } catch {
    return false;
  }
}
function listGitFiles(root) {
  try {
    const buf = (0, import_node_child_process.execFileSync)(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
    );
    return buf.split("\0").filter((p) => p.length > 0);
  } catch {
    return null;
  }
}

// src/scanner/index.ts
function scanRepository(root, opts = {}) {
  const git2 = isGitRepo(root);
  if (git2) {
    const rels = listGitFiles(root);
    if (rels) {
      const files = [];
      for (const rel of rels) {
        const posix = rel.split("\\").join("/");
        if (isExcludedFile(posix, opts)) continue;
        const abs = import_node_path5.default.join(root, ...posix.split("/"));
        let st;
        try {
          st = (0, import_node_fs4.lstatSync)(abs);
        } catch {
          continue;
        }
        if (st.isSymbolicLink()) continue;
        files.push({ absolutePath: abs, relative: posix });
      }
      return { files, git: true };
    }
  }
  return { files: walkFilesystem(root, opts), git: git2 };
}

// src/statistics/builtin/repository-scan.ts
var repositoryScanStatistic = defineStatistic({
  id: "repositoryScan",
  compute: (ctx) => scanRepository(ctx.projectRoot, {
    outputDirs: [ctx.outputDirRel],
    exclude: ctx.exclude
  })
});

// src/codebase/analyze.ts
var import_node_fs5 = require("fs");

// src/scanner/binary.ts
var SNIFF_BYTES = 8192;
function isBinary(buf) {
  const n = Math.min(buf.length, SNIFF_BYTES);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

// src/languages/detect.ts
var import_node_path6 = __toESM(require("path"));
var OTHER_ID = "other";
function detectByName(registry, filePath) {
  const base = import_node_path6.default.basename(filePath);
  const byName = registry.byFilename.get(base.toLowerCase());
  if (byName) return byName.id;
  const ext = import_node_path6.default.extname(base).toLowerCase();
  const byExt = registry.byExt.get(ext);
  if (byExt) return byExt.id;
  return void 0;
}
function detectByShebang(registry, firstLine) {
  if (!firstLine.startsWith("#!")) return void 0;
  const rest = firstLine.slice(2).trim();
  let interp;
  const envMatch = /\benv\s+([A-Za-z0-9_.-]+)/.exec(rest);
  if (envMatch) {
    interp = envMatch[1];
  } else {
    const segMatch = /\/([A-Za-z0-9_.-]+)(?:\s|$)/.exec(rest);
    interp = segMatch?.[1];
  }
  if (!interp) return void 0;
  const norm = interp.toLowerCase();
  for (const lang of registry.languages) {
    for (const s of lang.shebang ?? []) {
      if (norm === s.toLowerCase()) return lang.id;
    }
  }
  return void 0;
}

// src/languages/lexer.ts
function isSpace(ch) {
  return ch === " " || ch === "	" || ch === "\r" || ch === "\f" || ch === "\v";
}
function countSourceFile(content, syntax) {
  const lineComments = syntax.lineComment ?? [];
  const blockComments = syntax.blockComment ?? [];
  const stringDelims = [...syntax.strings ?? []].sort((a, b) => b.length - a.length);
  const blockStarts = [...blockComments].sort((a, b) => b[0].length - a[0].length);
  let effective = 0;
  let comments = 0;
  let blank = 0;
  let state = { kind: "code" };
  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  for (const rawLine of lines) {
    let sawCode = state.kind === "string";
    let sawComment = state.kind === "block";
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    let i = 0;
    const len = line.length;
    while (i < len) {
      if (state.kind === "block") {
        if (line.startsWith(state.end, i)) {
          i += state.end.length;
          state = { kind: "code" };
        } else {
          sawComment = true;
          i += 1;
        }
        continue;
      }
      if (state.kind === "string") {
        if (line[i] === "\\") {
          i += 2;
        } else if (line.startsWith(state.delim, i)) {
          i += state.delim.length;
          state = { kind: "code" };
        } else {
          i += 1;
        }
        continue;
      }
      if (isSpace(line[i] ?? "")) {
        i += 1;
        continue;
      }
      let hit = false;
      for (const marker of lineComments) {
        if (line.startsWith(marker, i)) {
          sawComment = true;
          i = len;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const [start, end] of blockStarts) {
        if (line.startsWith(start, i)) {
          sawComment = true;
          state = { kind: "block", end };
          i += start.length;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const delim of stringDelims) {
        if (line.startsWith(delim, i)) {
          sawCode = true;
          state = { kind: "string", delim };
          i += delim.length;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      sawCode = true;
      i += 1;
    }
    if (sawCode) effective += 1;
    else if (sawComment) comments += 1;
    else blank += 1;
  }
  return { effective, comments, blank };
}

// src/codebase/analyze.ts
var OTHER_LANG = { id: OTHER_ID, name: "Other", syntax: { strings: [] } };
var SNIFF_BYTES2 = 8192;
function dirAncestors(fileRel) {
  const parts = fileRel.split("/");
  parts.pop();
  const out = [];
  let cur = parts.join("/") || ".";
  for (; ; ) {
    out.push(cur);
    if (cur === ".") break;
    const idx = cur.lastIndexOf("/");
    cur = idx < 0 ? "." : cur.slice(0, idx);
  }
  return out;
}
function readFromFd(fd, size, pos) {
  const buf = Buffer.alloc(size);
  let filled = 0;
  try {
    while (filled < size) {
      const n = (0, import_node_fs5.readSync)(fd, buf, filled, size - filled, pos + filled);
      if (n <= 0) break;
      filled += n;
    }
  } catch {
    return null;
  }
  return buf.subarray(0, filled);
}
function analyzeCodebase(files, registry) {
  const per = /* @__PURE__ */ new Map();
  const countedByDir = /* @__PURE__ */ new Map();
  let totalLines = 0;
  let effectiveLines = 0;
  let commentLines = 0;
  let blankLines = 0;
  let analyzedSourceFiles = 0;
  for (const file of files) {
    let fd;
    try {
      fd = (0, import_node_fs5.openSync)(file.absolutePath, "r");
    } catch {
      continue;
    }
    let buf;
    try {
      const head = Buffer.alloc(SNIFF_BYTES2);
      const sniffed = (0, import_node_fs5.readSync)(fd, head, 0, SNIFF_BYTES2, 0);
      if (sniffed <= 0) {
        buf = Buffer.alloc(0);
      } else {
        if (isBinary(head.subarray(0, sniffed))) continue;
        const size = (0, import_node_fs5.fstatSync)(fd).size;
        const rest = readFromFd(fd, Math.max(0, size - sniffed), sniffed);
        if (rest === null) continue;
        buf = Buffer.concat([head.subarray(0, sniffed), rest]);
      }
    } catch {
      continue;
    } finally {
      (0, import_node_fs5.closeSync)(fd);
    }
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    } catch {
      continue;
    }
    if (content.includes("\uFFFD")) continue;
    let langId = detectByName(registry, file.relative);
    if (langId === void 0) {
      const firstLine = content.split("\n", 1)[0] ?? "";
      langId = detectByShebang(registry, firstLine);
    }
    const lang = langId && registry.byId.get(langId) || OTHER_LANG;
    const counts = countSourceFile(content, lang.syntax);
    totalLines += counts.effective + counts.comments + counts.blank;
    effectiveLines += counts.effective;
    commentLines += counts.comments;
    blankLines += counts.blank;
    analyzedSourceFiles += 1;
    for (const dir of dirAncestors(file.relative)) {
      const cur2 = countedByDir.get(dir) ?? { effective: 0, comments: 0, blank: 0 };
      cur2.effective += counts.effective;
      cur2.comments += counts.comments;
      cur2.blank += counts.blank;
      countedByDir.set(dir, cur2);
    }
    const id = lang.id;
    const cur = per.get(id);
    if (cur) {
      cur.effective += counts.effective;
      cur.comments += counts.comments;
      cur.blank += counts.blank;
      cur.files += 1;
    } else {
      per.set(id, { id, name: lang.name, effective: counts.effective, comments: counts.comments, blank: counts.blank, files: 1 });
    }
  }
  const languages = [...per.values()].map((s) => ({
    id: s.id,
    name: s.name,
    effective: s.effective,
    comments: s.comments,
    files: s.files
  }));
  return { totalLines, effectiveLines, commentLines, blankLines, analyzedSourceFiles, languages, countedByDir };
}

// src/statistics/legacy-internal.ts
function legacyView(value) {
  return value;
}

// src/statistics/builtin/codebase.ts
var codebaseStatistics = defineStatistic({
  id: "codebase",
  compute: (ctx) => {
    const scan = legacyView(ctx.statistics.get(repositoryScanStatistic));
    return analyzeCodebase(scan.files, ctx.registry);
  }
});

// src/structure/tree.ts
function dirPathOf(fileRel) {
  const parts = fileRel.split("/");
  parts.pop();
  return parts;
}
function buildTree(files, root, maxDepth) {
  const rootRel = root === "." ? "." : root;
  const synthetic = {
    name: root === "." ? "." : root,
    rel: ".",
    repoRel: rootRel,
    depth: -1,
    descendantDirs: 0,
    directDirs: 0,
    directFiles: 0,
    children: []
  };
  for (const file of files) {
    const dirParts = dirPathOf(file.relative);
    let node = synthetic;
    for (const part of dirParts) {
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        const childRel = node.rel === "." ? part : `${node.rel}/${part}`;
        const childRepoRel = synthetic.repoRel === "." ? childRel : `${synthetic.repoRel}/${childRel}`;
        child = { name: part, rel: childRel, repoRel: childRepoRel, depth: node.depth + 1, descendantDirs: 0, directDirs: 0, directFiles: 0, children: [], parent: node };
        node.children.push(child);
      }
      node = child;
    }
    node.directFiles += 1;
  }
  const sortAndCount = (node) => {
    node.children.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    node.directDirs = node.children.length;
    let count = 0;
    for (const child of node.children) count += 1 + sortAndCount(child);
    node.descendantDirs = count;
    return count;
  };
  sortAndCount(synthetic);
  const prune = (node, depth) => {
    if (depth >= maxDepth) {
      node.children = [];
      return;
    }
    for (const child of node.children) prune(child, depth + 1);
  };
  prune(synthetic, 0);
  return synthetic;
}
function flattenTree(root) {
  const out = [];
  const walk = (node) => {
    if (node.depth >= 0) out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

// src/statistics/builtin/tree.ts
function filesUnderRoot(files, rootRel) {
  return files.filter((f) => f.relative.startsWith(`${rootRel}/`)).map((f) => ({ ...f, relative: f.relative.slice(rootRel.length + 1) }));
}
var treeStatistics = defineStatistic({
  id: "tree",
  cacheKey: (params) => `${params.root}|${params.maxDepth}`,
  compute: (ctx, params) => {
    const scan = legacyView(ctx.statistics.get(repositoryScanStatistic));
    const rootRel = normalizeStructureRoot(params.root, ctx.projectRoot);
    const files = rootRel ? filesUnderRoot(scan.files, rootRel) : scan.files;
    return buildTree(files, rootRel ?? ".", params.maxDepth);
  }
});

// src/structure/activity.ts
var import_node_child_process2 = require("child_process");

// src/structure/dates.ts
function utcDay(d) {
  return d.toISOString().slice(0, 10);
}
function addUtcDays(dateStr, delta) {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(t + delta * 864e5).toISOString().slice(0, 10);
}
function dayOfWeekUtc(dateStr) {
  return (/* @__PURE__ */ new Date(`${dateStr}T00:00:00Z`)).getUTCDay();
}
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}
function bucketDates(endDay, days) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addUtcDays(endDay, i - (days - 1)));
  return out;
}
function resolveActivityWindow(days, anchor, now, latestCommitDay) {
  const endDate = anchor === "last-activity" && latestCommitDay ? latestCommitDay : utcDay(now);
  const dates = bucketDates(endDate, days);
  return { anchor, days, endDate, startDate: dates[0], dates };
}

// src/structure/activity.ts
function dirChain(fileRel) {
  const parts = fileRel.split("/");
  parts.pop();
  const out = [];
  let cur = parts.join("/") || ".";
  for (; ; ) {
    out.push(cur);
    if (cur === ".") break;
    const idx = cur.lastIndexOf("/");
    cur = idx < 0 ? "." : cur.slice(0, idx);
  }
  return out;
}
var COMMIT_HEADER_RE = /^[0-9a-f]{40,64}\n\d{4}-\d{2}-\d{2}T/;
var NUMSTAT_RE = /^\d+\t\d+(\t|$)/;
function gitShowPrefix(root) {
  try {
    const out = (0, import_node_child_process2.execFileSync)(
      "git",
      ["rev-parse", "--show-prefix"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.trim();
  } catch {
    return "";
  }
}
function alignPrefix(p, prefix) {
  if (!prefix) return p;
  if (!p.startsWith(prefix)) return null;
  return p.slice(prefix.length);
}
function latestCommitDayUtc(root) {
  try {
    const out = (0, import_node_child_process2.execFileSync)(
      "git",
      ["log", "-1", "--format=%cI"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return out ? utcDay(new Date(out)) : null;
  } catch {
    return null;
  }
}
function runGitActivity(root, days, now, opts = {}, anchor = "recent") {
  const latestDay = anchor === "last-activity" ? latestCommitDayUtc(root) : null;
  const window = resolveActivityWindow(days, anchor, now, latestDay);
  const since = `${window.startDate}T00:00:00Z`;
  const prefix = gitShowPrefix(root);
  let out;
  try {
    out = (0, import_node_child_process2.execFileSync)(
      "git",
      ["log", "--numstat", "-z", "--format=%H%n%cI", "--find-renames", `--since=${since}`],
      { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
    );
  } catch {
    return null;
  }
  return parseGitLogNumstat(out, window.startDate, days, prefix, opts);
}
function parseGitLogNumstat(output, startStr, days, prefix = "", opts = {}) {
  const byDir = /* @__PURE__ */ new Map();
  const empty = () => Array.from({ length: days }, () => ({ commits: 0, additions: 0, deletions: 0 }));
  const ensure = (dir) => {
    let arr = byDir.get(dir);
    if (!arr) {
      arr = empty();
      byDir.set(dir, arr);
    }
    return arr;
  };
  let totalCommits = 0;
  let currentDayIndex = -1;
  let touched = null;
  let commitHasValidFile = false;
  const finalize = () => {
    if (touched === null || currentDayIndex < 0) return;
    if (!commitHasValidFile) return;
    totalCommits += 1;
    for (const [dir, deltas] of touched) {
      const arr = ensure(dir);
      arr[currentDayIndex].commits += 1;
      arr[currentDayIndex].additions += deltas.additions;
      arr[currentDayIndex].deletions += deltas.deletions;
    }
  };
  const records = output.split("\0");
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (COMMIT_HEADER_RE.test(rec)) {
      finalize();
      const nl = rec.indexOf("\n");
      const iso = nl >= 0 ? rec.slice(nl + 1) : "";
      const dayIndex = iso ? daysBetween(startStr, utcDay(new Date(iso))) : -1;
      if (iso && dayIndex >= 0 && dayIndex < days) {
        currentDayIndex = dayIndex;
        touched = /* @__PURE__ */ new Map();
        commitHasValidFile = false;
      } else {
        currentDayIndex = -1;
        touched = null;
        commitHasValidFile = false;
      }
      continue;
    }
    if (touched === null) continue;
    const recBody = rec.startsWith("\n") ? rec.slice(1) : rec;
    if (!NUMSTAT_RE.test(recBody)) continue;
    const t1 = recBody.indexOf("	");
    const t2 = t1 >= 0 ? recBody.indexOf("	", t1 + 1) : -1;
    if (t1 < 0 || t2 < 0) continue;
    const addedStr = recBody.slice(0, t1);
    const deletedStr = recBody.slice(t1 + 1, t2);
    const added = parseInt(addedStr, 10);
    const deleted = parseInt(deletedStr, 10);
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue;
    let path22 = recBody.slice(t2 + 1);
    if (path22 === "") {
      const oldRaw = (records[i + 1] ?? "").replace(/^\n/, "");
      const newRaw = (records[i + 2] ?? "").replace(/^\n/, "");
      if (records[i + 2] === void 0) continue;
      i += 2;
      const oldAligned = alignPrefix(oldRaw, prefix);
      const newAligned = alignPrefix(newRaw, prefix);
      if (oldAligned === null && newAligned === null) continue;
      const oldInScope = oldAligned !== null && !isExcludedFile(oldAligned, opts);
      const newInScope = newAligned !== null && !isExcludedFile(newAligned, opts);
      if (!oldInScope && !newInScope) continue;
      commitHasValidFile = true;
      if (newInScope && newAligned !== null) {
        for (const dir of dirChain(newAligned)) {
          const cur = touched.get(dir) ?? { additions: 0, deletions: 0 };
          cur.additions += added;
          cur.deletions += deleted;
          touched.set(dir, cur);
        }
      }
      continue;
    }
    const aligned = alignPrefix(path22, prefix);
    if (aligned === null) continue;
    if (isExcludedFile(aligned, opts)) continue;
    commitHasValidFile = true;
    for (const dir of dirChain(aligned)) {
      const cur = touched.get(dir) ?? { additions: 0, deletions: 0 };
      cur.additions += added;
      cur.deletions += deleted;
      touched.set(dir, cur);
    }
  }
  finalize();
  return { byDir, totalCommits, days, startDate: startStr };
}

// src/statistics/builtin/activity.ts
var activityStatistics = defineStatistic({
  id: "activity",
  cacheKey: (params) => `${params.anchor}|${params.days}`,
  compute: (ctx, params) => runGitActivity(ctx.projectRoot, params.days, ctx.now, {
    outputDirs: ctx.activityDirs,
    exclude: ctx.exclude
  }, params.anchor)
});

// src/util/sort.ts
function compareCodeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// src/codebase/model.ts
function countedLines(stat, includeComments) {
  return stat.effective + (includeComments ? stat.comments : 0);
}
function compareLanguageRank(a, b, includeComments) {
  const diff = countedLines(b, includeComments) - countedLines(a, includeComments);
  if (diff !== 0) return diff;
  return compareCodeUnit(a.name, b.name);
}
function sortLanguages(langs, includeComments) {
  return [...langs].sort((a, b) => compareLanguageRank(a, b, includeComments));
}
function rankLanguages(stats, includeComments, dataColors) {
  const ranked = sortLanguages(stats, includeComments);
  const colorById = /* @__PURE__ */ new Map();
  ranked.forEach((stat, i) => {
    const color = dataColors[i % dataColors.length];
    if (color) colorById.set(stat.id, color);
  });
  return { ranked, colorById };
}

// src/util/format.ts
function round1(value) {
  return Math.round(value * 10) / 10;
}
function formatInteger(value) {
  const digits = String(Math.trunc(value));
  let out = "";
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    out = digits.charAt(i) + out;
    count += 1;
    if (count % 3 === 0 && i > 0) out = "," + out;
  }
  return out;
}
function formatPercent(fraction) {
  const percent = round1(fraction * 100);
  return `${percent.toFixed(1)}%`;
}

// src/codebase/card.ts
function buildCodebaseCard(data, includeComments, dataColors) {
  const { ranked, colorById } = rankLanguages(data.languages, includeComments, dataColors);
  const total = data.totalLines;
  const totalCounted = includeComments ? data.effectiveLines + data.commentLines : data.effectiveLines;
  const languages = ranked.map((s) => {
    const counted = includeComments ? s.effective + s.comments : s.effective;
    const fraction = totalCounted > 0 ? counted / totalCounted : 0;
    return {
      id: s.id,
      name: s.name,
      color: colorById.get(s.id) ?? "#A49E94",
      counted,
      fraction,
      value: `${formatInteger(counted)} \xB7 ${formatPercent(fraction)}`
    };
  });
  const effectiveFrac = total > 0 ? data.effectiveLines / total : 0;
  const commentsFrac = total > 0 ? data.commentLines / total : 0;
  const blankFrac = total > 0 ? data.blankLines / total : 0;
  return {
    total: formatInteger(total),
    effective: `${formatInteger(data.effectiveLines)} \xB7 ${formatPercent(effectiveFrac)}`,
    comments: `${formatInteger(data.commentLines)} \xB7 ${formatPercent(commentsFrac)}`,
    blank: `${formatInteger(data.blankLines)} \xB7 ${formatPercent(blankFrac)}`,
    summaryFracs: [effectiveFrac, commentsFrac, blankFrac],
    languages,
    includeComments
  };
}

// src/layout/measure.ts
var COMBINING_START = 768;
var COMBINING_END = 879;
var WIDE_START = 11904;
var REGULAR_WEIGHT = 400;
var BOLD_WEIGHT = 700;
var MAX_WEIGHT_GROWTH = 0.12;
function weightScale(fontWeight) {
  if (fontWeight <= REGULAR_WEIGHT) return 1;
  const t = Math.min(1, (fontWeight - REGULAR_WEIGHT) / (BOLD_WEIGHT - REGULAR_WEIGHT));
  return 1 + t * MAX_WEIGHT_GROWTH;
}
function estimateTextWidth(text, opts) {
  const em = opts.fontSize;
  const scale = weightScale(opts.fontWeight ?? REGULAR_WEIGHT);
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= COMBINING_START && cp <= COMBINING_END) continue;
    if (cp >= WIDE_START) {
      width += em;
    } else if (opts.mono) {
      width += 0.6 * em * scale;
    } else if (ch === " " || ch === ".") {
      width += 0.28 * em * scale;
    } else if (ch === "\xB7" || ch === "," || ch === "'" || ch === "(" || ch === ")") {
      width += 0.3 * em * scale;
    } else {
      width += 0.55 * em * scale;
    }
  }
  return width + (opts.mono ? 0 : 2);
}

// src/layout/languages.ts
var MINI_BAR_WIDTH = 19;
var MINI_BAR_HEIGHT = 4;
var MINI_BAR_GAP = 8;
var SWATCH_TEXT_OFFSET = MINI_BAR_WIDTH + MINI_BAR_GAP;
var LANGUAGE_ITEM_GAP = 32;
var LANGUAGE_ROW_HEIGHT = 42;
var NAME_FONT_SIZE = 11;
var VALUE_FONT_SIZE = 10.5;
var LABEL_TO_VALUE_GAP = 17;
var LABEL_TOP_PAD = 5;
var TEXT_VISUAL_CENTER = 0.35;
var AREA_BOTTOM_PAD = 23;
function legendItemGeometry(labelBaseline, lineGap = LABEL_TO_VALUE_GAP) {
  const valueBaseline = labelBaseline + lineGap;
  const barCenterY = labelBaseline - NAME_FONT_SIZE * TEXT_VISUAL_CENTER;
  return { labelBaseline, valueBaseline, barCenterY, barY: barCenterY - MINI_BAR_HEIGHT / 2 };
}
function measureItem(it, mbarW, mbarGap) {
  const nameWidth = estimateTextWidth(it.name, { fontSize: NAME_FONT_SIZE, mono: false });
  const valueWidth = estimateTextWidth(it.value, { fontSize: VALUE_FONT_SIZE, mono: true });
  return { nameWidth, valueWidth, requiredHeight: NAME_FONT_SIZE + LABEL_TO_VALUE_GAP };
}
function measureLanguageCell(items, opts) {
  const mbarW = opts.miniBarWidth ?? MINI_BAR_WIDTH;
  const mbarGap = opts.miniBarGap ?? MINI_BAR_GAP;
  const nameLeftOffset = mbarW + mbarGap;
  let content = 0;
  for (const it of items) {
    const m = measureItem(it, mbarW, mbarGap);
    content = Math.max(content, m.nameWidth, m.valueWidth);
  }
  return { cellWidth: nameLeftOffset + content };
}
function resolveColumns(cellWidth, itemCount, availableWidth, gap = LANGUAGE_ITEM_GAP) {
  const denom = cellWidth + gap;
  const maxColumns = denom > 0 ? Math.max(1, Math.floor((availableWidth + gap) / denom)) : itemCount;
  return Math.min(maxColumns, itemCount);
}
function gridWidth(count, cellWidth, gap = LANGUAGE_ITEM_GAP) {
  if (count <= 0) return 0;
  return count * cellWidth + (count - 1) * gap;
}
function chooseLegendColumns(itemCount, cellWidth, availableWidth, gap = LANGUAGE_ITEM_GAP, comfortMargin = gap) {
  const maxFit = resolveColumns(cellWidth, itemCount, availableWidth, gap);
  if (maxFit === 5 && availableWidth - gridWidth(5, cellWidth, gap) < comfortMargin && availableWidth - gridWidth(4, cellWidth, gap) >= comfortMargin) {
    return 4;
  }
  return maxFit;
}
function centeredRowStart(count, cellWidth, gap, contentLeft, contentWidth) {
  if (count <= 0) return contentLeft;
  const rowWidth = gridWidth(count, cellWidth, gap);
  return contentLeft + (contentWidth - rowWidth) / 2;
}
function chunkColumns(itemCount, columns) {
  const rows = [];
  for (let start = 0; start < itemCount; start += columns) {
    const end = Math.min(start + columns, itemCount);
    const row = [];
    for (let i = start; i < end; i++) row.push(i);
    rows.push(row);
  }
  return rows;
}
function layoutLanguageArea(items, opts) {
  const gap = opts.itemGap ?? LANGUAGE_ITEM_GAP;
  const rowHeight = opts.rowHeight ?? LANGUAGE_ROW_HEIGHT;
  const mbarW = opts.miniBarWidth ?? MINI_BAR_WIDTH;
  const mbarGap = opts.miniBarGap ?? MINI_BAR_GAP;
  const left = opts.left;
  const nameLeftOffset = mbarW + mbarGap;
  if (items.length === 0) {
    return {
      items: [],
      rows: [],
      columns: 0,
      cellWidth: nameLeftOffset,
      height: 0,
      distribution: []
    };
  }
  const measures = items.map((it) => measureItem(it, mbarW, mbarGap));
  let content = 0;
  for (const m of measures) {
    content = Math.max(content, m.nameWidth, m.valueWidth);
  }
  const cellWidth = opts.cellWidth ?? nameLeftOffset + content;
  const columns = opts.columns ?? chooseLegendColumns(items.length, cellWidth, opts.contentWidth, gap);
  const rowIndices = chunkColumns(items.length, columns);
  const rows = [];
  const placements = [];
  let labelBaseline = opts.top + LABEL_TOP_PAD;
  for (let r = 0; r < rowIndices.length; r++) {
    const indices = rowIndices[r];
    const rowLeft = centeredRowStart(indices.length, cellWidth, gap, left, opts.contentWidth);
    const geom = legendItemGeometry(labelBaseline);
    rows.push({ indices, labelBaseline: geom.labelBaseline, valueBaseline: geom.valueBaseline });
    for (let col = 0; col < indices.length; col++) {
      const itemIndex = indices[col];
      const it = items[itemIndex];
      if (!it) continue;
      const cellLeft = rowLeft + col * (cellWidth + gap);
      const miniBarLeft = cellLeft;
      const nameLeft = miniBarLeft + nameLeftOffset;
      const labelCenterY = labelBaseline - NAME_FONT_SIZE * TEXT_VISUAL_CENTER;
      placements.push({
        index: itemIndex,
        id: it.id,
        name: it.name,
        value: it.value,
        color: it.color,
        row: r,
        col,
        cellLeft,
        itemLeft: cellLeft,
        width: cellWidth,
        miniBarLeft,
        nameLeft,
        valueLeft: miniBarLeft,
        labelCenterY,
        miniBarY: geom.barY,
        nameBaseline: geom.labelBaseline,
        valueBaseline: geom.valueBaseline
      });
    }
    labelBaseline += rowHeight;
  }
  const height = (rowIndices.length - 1) * rowHeight + (LABEL_TOP_PAD + LABEL_TO_VALUE_GAP) + AREA_BOTTOM_PAD;
  return {
    items: placements,
    rows,
    columns,
    cellWidth,
    height,
    distribution: rowIndices.map((r) => r.length)
  };
}

// src/layout/codebase.ts
var CARD_PAD = 24;
var SUMMARY_BAR_Y = 59;
var BAR_HEIGHT = 4;
var FAN_BOTTOM_Y = 97;
var LANGUAGE_BAR_Y = 97;
var LANGUAGE_AREA_GAP = 24;
var NAME_FONT = NAME_FONT_SIZE;
var VALUE_FONT = VALUE_FONT_SIZE;
function metricWidth(name, value) {
  const nameW = estimateTextWidth(name, { fontSize: NAME_FONT, mono: false });
  const valueW = estimateTextWidth(value, { fontSize: VALUE_FONT, mono: true });
  return SWATCH_TEXT_OFFSET + Math.max(nameW, valueW);
}
function layoutCodebase(data, opts = {}) {
  const includeComments = data.includeComments;
  const metricDefs = [
    { name: "Total", value: data.total, barColorKey: "text" },
    { name: "Effective", value: data.effective, barColorKey: "accent" },
    { name: "Comments", value: data.comments, barColorKey: "accentSoft" },
    { name: "Blank", value: data.blank, barColorKey: "neutral" }
  ];
  const contentLeft = CARD_PAD;
  const langItems = data.languages.map((l) => ({
    id: l.id,
    name: l.name,
    value: l.value,
    color: l.color
  }));
  const areaTop = LANGUAGE_BAR_Y + BAR_HEIGHT + LANGUAGE_AREA_GAP;
  const summaryColumns = 4;
  const metricCells = metricDefs.map((m) => metricWidth(m.name, m.value));
  const langCell = langItems.length > 0 ? measureLanguageCell(langItems, {}).cellWidth : 0;
  const legendCell = Math.max(...metricCells, langCell);
  const gap = LANGUAGE_ITEM_GAP;
  const minCardWidth = opts.minCardWidth ?? 680;
  let cardWidth = minCardWidth;
  for (let i = 0; i < 20; i++) {
    const contentWidth2 = cardWidth - CARD_PAD * 2;
    const langCols = langItems.length > 0 ? chooseLegendColumns(langItems.length, legendCell, contentWidth2, gap) : 0;
    const need = Math.max(
      contentWidth2,
      Math.ceil(
        Math.max(
          gridWidth(summaryColumns, legendCell, gap),
          langCols > 0 ? gridWidth(langCols, legendCell, gap) : 0
        )
      )
    );
    const targetCard = need + CARD_PAD * 2;
    if (targetCard <= cardWidth) break;
    cardWidth = targetCard;
  }
  const contentWidth = cardWidth - CARD_PAD * 2;
  const centerX = cardWidth / 2;
  const contentRight = cardWidth - CARD_PAD;
  const summaryRowLeft = centeredRowStart(summaryColumns, legendCell, gap, contentLeft, contentWidth);
  const summaryColumnAnchors = Array.from({ length: summaryColumns }, (_, i) => summaryRowLeft + i * (legendCell + gap));
  const metrics = metricDefs.map((m, i) => ({
    left: summaryColumnAnchors[i],
    name: m.name,
    value: m.value,
    barColorKey: m.barColorKey
  }));
  const languageColumns = langItems.length > 0 ? chooseLegendColumns(langItems.length, legendCell, contentWidth, gap) : 0;
  const alignLanguageToSummary = langItems.length > 0 && languageColumns === summaryColumns;
  let languageArea = {
    items: [],
    rows: [],
    columns: 0,
    cellWidth: 0,
    height: 0,
    distribution: []
  };
  if (langItems.length > 0) {
    languageArea = layoutLanguageArea(langItems, {
      contentWidth,
      left: contentLeft,
      top: areaTop,
      columns: languageColumns,
      cellWidth: legendCell,
      itemGap: gap
    });
  }
  const summaryW = 0.8 * contentWidth;
  const summaryLeft = centerX - summaryW / 2;
  const [effFrac, comFrac, blankFrac] = data.summaryFracs;
  const effEnd = summaryLeft + effFrac * summaryW;
  const comEnd = summaryLeft + (effFrac + comFrac) * summaryW;
  const blankEnd = summaryLeft + (effFrac + comFrac + blankFrac) * summaryW;
  const languageBarSegs = [];
  {
    const barEnd = contentLeft + contentWidth;
    let x = contentLeft;
    for (const l of data.languages) {
      if (x >= barEnd) break;
      const width = Math.min(l.fraction * contentWidth, barEnd - x);
      if (width <= 0) break;
      languageBarSegs.push({ x, width, color: l.color });
      x += width;
    }
  }
  const languageBar = {
    left: contentLeft,
    width: contentWidth,
    segments: languageBarSegs
  };
  const fanTopRight = includeComments ? comEnd : effEnd;
  const cardHeight = areaTop + languageArea.height;
  return {
    cardWidth,
    cardHeight,
    contentLeft,
    contentRight,
    centerX,
    metrics,
    summary: { left: summaryLeft, width: summaryW, effEnd, comEnd, blankEnd },
    fanTopLeft: summaryLeft,
    fanTopRight,
    hasLanguageData: data.languages.some((l) => l.counted > 0),
    hasSummaryData: data.summaryFracs.some((f) => f > 0),
    languageBar,
    languageArea,
    summaryColumnAnchors,
    summaryRowWidth: gridWidth(summaryColumns, legendCell, gap),
    legendCellWidth: legendCell,
    alignLanguageToSummary
  };
}

// src/render/svg.ts
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function r1(value) {
  return String(Math.round(value * 10) / 10);
}
function r2(value) {
  return String(Math.round(value * 100) / 100);
}

// src/codebase/render.ts
function chromeOf(theme) {
  return {
    text: theme.palette.text,
    muted: theme.palette.text_muted,
    surface: theme.palette.surface,
    border: theme.palette.border_muted,
    divider: theme.palette.divider,
    accent: theme.codebase.effective,
    accentSoft: theme.codebase.comments,
    neutral: theme.codebase.blank
  };
}
function barSegment(x, width, y, h, radius, roundLeft, roundRight, fill) {
  const r = Math.min(radius, width / 2);
  if (roundLeft && roundRight) {
    return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(width)}" height="${r1(h)}" rx="${r1(r)}" fill="${fill}"/>`;
  }
  if (roundLeft) {
    return `<path d="M${r1(x + r)} ${r1(y)}H${r1(x + width)}V${r1(y + h)}H${r1(x + r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x)} ${r1(y + h / 2)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + r)} ${r1(y)}Z" fill="${fill}"/>`;
  }
  if (roundRight) {
    return `<path d="M${r1(x)} ${r1(y)}H${r1(x + width - r)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + width)} ${r1(y + h / 2)}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + width - r)} ${r1(y + h)}H${r1(x)}Z" fill="${fill}"/>`;
  }
  return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(width)}" height="${r1(h)}" fill="${fill}"/>`;
}
function renderCodebaseCard(layout, theme) {
  const c = chromeOf(theme);
  const { cardWidth, cardHeight, contentLeft, contentRight, centerX } = layout;
  const edge = theme.codebase.fanEdgeStrokeOpacity;
  const cardRadius = theme.style.card.radius;
  const cardBorderW = theme.style.card.border_width;
  const barRadius = theme.style.bar.radius;
  const borderInset = cardBorderW / 2;
  const metricItem = legendItemGeometry(-4.5);
  const metricsSvg = layout.metrics.map((m) => {
    const bar = m.barColorKey === "text" ? c.text : m.barColorKey === "accent" ? c.accent : m.barColorKey === "accentSoft" ? c.accentSoft : c.neutral;
    return `<g transform="translate(${r1(m.left)} 32)"><rect x="0" y="${r1(metricItem.barY)}" width="${MINI_BAR_WIDTH}" height="${MINI_BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${bar}"/><text x="${SWATCH_TEXT_OFFSET}" y="${metricItem.labelBaseline}" class="name">${escapeXml(m.name)}</text><text x="0" y="${metricItem.valueBaseline}" class="data">${escapeXml(m.value)}</text></g>`;
  }).join("\n    ");
  const s = layout.summary;
  const effW = s.effEnd - s.left;
  const comW = s.comEnd - s.effEnd;
  const blankW = s.blankEnd - s.comEnd;
  const summarySvg = `<rect x="${r1(s.left)}" y="${SUMMARY_BAR_Y}" width="${r1(s.width)}" height="${BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${c.divider}"/>` + (effW > 0 ? barSegment(s.left, effW, SUMMARY_BAR_Y, BAR_HEIGHT, barRadius, true, false, c.accent) : "") + (comW > 0 ? `<rect x="${r1(s.effEnd)}" y="${SUMMARY_BAR_Y}" width="${r1(comW)}" height="${BAR_HEIGHT}" fill="${c.accentSoft}"/>` : "") + (blankW > 0 ? barSegment(s.comEnd, blankW, SUMMARY_BAR_Y, BAR_HEIGHT, barRadius, false, true, c.neutral) : "");
  const fan = theme.codebase;
  const fanSvg = layout.hasLanguageData ? [
    `<defs>`,
    `<linearGradient id="fanFill" x1="0" y1="${SUMMARY_BAR_Y + BAR_HEIGHT}" x2="0" y2="${FAN_BOTTOM_Y}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${fan.fanColor}" stop-opacity="${r2(fan.fanFillStart)}"/><stop offset="100%" stop-color="${fan.fanColor}" stop-opacity="${r2(fan.fanFillEnd)}"/></linearGradient>`,
    `<linearGradient id="fanStrokeL" x1="${r1(layout.fanTopLeft)}" y1="${SUMMARY_BAR_Y + BAR_HEIGHT}" x2="${r1(contentLeft)}" y2="${FAN_BOTTOM_Y}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/><stop offset="100%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/></linearGradient>`,
    `<linearGradient id="fanStrokeR" x1="${r1(layout.fanTopRight)}" y1="${SUMMARY_BAR_Y + BAR_HEIGHT}" x2="${r1(contentRight)}" y2="${FAN_BOTTOM_Y}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/><stop offset="100%" stop-color="${fan.fanColor}" stop-opacity="${r2(edge)}"/></linearGradient>`,
    `</defs>`,
    `<path d="M${r1(layout.fanTopLeft)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(layout.fanTopRight)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(contentRight)} ${FAN_BOTTOM_Y}L${r1(contentLeft)} ${FAN_BOTTOM_Y}Z" fill="url(#fanFill)"/>`,
    `<path d="M${r1(layout.fanTopLeft)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(contentLeft)} ${FAN_BOTTOM_Y}" fill="none" stroke="url(#fanStrokeL)" stroke-width="1" stroke-linecap="round"/>`,
    `<path d="M${r1(layout.fanTopRight)} ${SUMMARY_BAR_Y + BAR_HEIGHT}L${r1(contentRight)} ${FAN_BOTTOM_Y}" fill="none" stroke="url(#fanStrokeR)" stroke-width="1" stroke-linecap="round"/>`
  ].join("\n    ") : "";
  const lb = layout.languageBar;
  const segs = lb.segments.map(
    (seg) => seg.width > 0 ? `<rect x="${r1(seg.x)}" y="${LANGUAGE_BAR_Y}" width="${r1(seg.width)}" height="${BAR_HEIGHT}" fill="${seg.color}"/>` : ""
  ).join("");
  const items = layout.languageArea.items.map(
    (p) => `<g>
      <rect x="${r1(p.miniBarLeft)}" y="${r1(p.miniBarY)}" width="${MINI_BAR_WIDTH}" height="${MINI_BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${p.color}"/>
      <text x="${r1(p.nameLeft)}" y="${r1(p.nameBaseline)}" class="name">${escapeXml(p.name)}</text>
      <text x="${r1(p.valueLeft)}" y="${r1(p.valueBaseline)}" class="data">${escapeXml(p.value)}</text>
    </g>`
  ).join("\n      ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" role="img" aria-labelledby="cb-title cb-desc">
  <title id="cb-title">arte-git-card \xB7 Codebase</title>
  <desc id="cb-desc">Total lines, effective lines, comments and blank lines with full language composition.</desc>
  <style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${c.text};text-rendering:geometricPrecision}
    .name{font-size:${NAME_FONT}px;font-weight:700}
    .data{font-size:${VALUE_FONT}px;fill:${c.muted};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  </style>
  <rect x="${r1(borderInset)}" y="${r1(borderInset)}" width="${r1(cardWidth - cardBorderW)}" height="${r1(cardHeight - cardBorderW)}" rx="${r1(cardRadius)}" stroke-width="${cardBorderW}" fill="${c.surface}" stroke="${c.border}"/>
  <g>
    ${metricsSvg}
  </g>
  ${summarySvg}
  ${fanSvg}
  <rect x="${r1(lb.left)}" y="${LANGUAGE_BAR_Y}" width="${r1(lb.width)}" height="${BAR_HEIGHT}" rx="${r1(barRadius)}" fill="${c.divider}"/>
  <defs><clipPath id="agcLangBarClip"><rect x="${r1(lb.left)}" y="${LANGUAGE_BAR_Y}" width="${r1(lb.width)}" height="${BAR_HEIGHT}" rx="${r1(barRadius)}"/></clipPath></defs>
  <g clip-path="url(#agcLangBarClip)">${segs}</g>
  <g>
      ${items}
  </g>
</svg>
`;
}

// src/display/builtin/codebase/presenter.ts
function renderCodebaseDisplay(ctx) {
  const data = legacyView(ctx.statistics.get(codebaseStatistics));
  const theme = legacyView(ctx.theme);
  const cardData = buildCodebaseCard(data, ctx.config.languages.include_comments, theme.dataColors);
  const layout = layoutCodebase(cardData);
  return renderCodebaseCard(layout, theme);
}

// src/display/builtin/codebase/definition.ts
var codebaseSchema = external_exports.object({
  enabled: external_exports.boolean(),
  languages: external_exports.object({ include_comments: external_exports.boolean() }).strict()
}).strict();
var codebaseDisplay = defineLegacySvgDisplay({
  id: "codebase",
  title: "Codebase",
  config: {
    schema: codebaseSchema,
    defaults: () => ({ enabled: false, languages: { include_comments: false } }),
    requiredInSchemaV2: true,
    settings: [
      {
        key: "include-comments",
        type: "boolean",
        description: "Include comment lines in language stats",
        read: (c) => c.languages.include_comments,
        apply: (c, raw) => {
          c.languages.include_comments = parseBool(raw, "codebase.include-comments");
        },
        reset: (c) => {
          c.languages.include_comments = false;
        }
      }
    ]
  },
  // Byte-locked legacy renderer (golden). NOT migrated to the safe template runtime.
  template: (ctx) => renderCodebaseDisplay(ctx)
});

// src/structure/model.ts
function emptyDays(days) {
  return Array.from({ length: days }, () => ({ commits: 0, additions: 0, deletions: 0 }));
}
function recentStart(now, days) {
  return new Date(now.getTime() - (days - 1) * 864e5).toISOString().slice(0, 10);
}
function buildStructureData(tree, activity, days, now, repoName) {
  const byDir = (repoRel) => activity?.byDir.get(repoRel) ?? emptyDays(days);
  const rootShift = repoName != null ? 1 : 0;
  const rows = [];
  if (repoName != null) {
    rows.push({
      name: repoName,
      rel: ".",
      repoRel: ".",
      depth: 0,
      descendantDirs: tree.descendantDirs,
      dirs: tree.directDirs,
      files: tree.directFiles,
      hasChildren: tree.children.length > 0,
      activity: byDir(".")
    });
  }
  for (const node of flattenTree(tree)) {
    rows.push({
      name: node.name,
      rel: node.rel,
      repoRel: node.repoRel,
      depth: node.depth + rootShift,
      descendantDirs: node.descendantDirs,
      dirs: node.directDirs,
      files: node.directFiles,
      hasChildren: node.children.length > 0,
      activity: byDir(node.repoRel)
    });
  }
  return {
    rows,
    days,
    totalCommits: activity?.totalCommits ?? 0,
    startDate: activity?.startDate ?? recentStart(now, days)
  };
}

// src/structure/share.ts
function countedLines2(d, includeComments) {
  if (!d) return 0;
  return d.effective + (includeComments ? d.comments : 0);
}
function codeShareOf(countedByDir, repoRel, includeComments) {
  const total = countedLines2(countedByDir.get("."), includeComments);
  if (total <= 0) return 0;
  return countedLines2(countedByDir.get(repoRel), includeComments) / total;
}
function shareLabel(fraction) {
  const p = (Number.isFinite(fraction) ? fraction : 0) * 100;
  const rounded = Math.round(p * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

// src/structure/header.ts
var WEEKDAY_BY_DOW = ["S", "M", "T", "W", "T", "F", "S"];
function dayOfMonthLabel(dateStr) {
  const day = Number(dateStr.slice(8, 10));
  return day < 10 ? `0${day}` : String(day);
}
function resolveActivityHeader(days, startDate) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addUtcDays(startDate, i);
    const label = days <= 7 ? WEEKDAY_BY_DOW[dayOfWeekUtc(date)] : dayOfMonthLabel(date);
    out.push({ cellIndex: i, label });
  }
  return out;
}

// src/structure/commit-scale.ts
function quantileAt(sorted, p) {
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}
var above = (q) => Math.floor(q) + 1;
function buildCommitScale(positiveNonRootCounts) {
  const positives = positiveNonRootCounts.filter((v) => v > 0).sort((a, b) => a - b);
  if (positives.length === 0) return { thresholds: [0], levels: [0] };
  const q1Full = quantileAt(positives, 0.25);
  const q3Full = quantileAt(positives, 0.75);
  const upperFence = q3Full + 1.5 * (q3Full - q1Full);
  const calibration = positives.filter((v) => v <= upperFence);
  const source = calibration.length > 0 ? calibration : positives;
  const q1 = quantileAt(source, 0.25);
  const q2 = quantileAt(source, 0.5);
  const q3 = quantileAt(source, 0.75);
  const minima = [1, above(q1), above(q2), above(q3)];
  const thresholds = [0];
  const levels = [0];
  for (let level = 1; level <= 4; level++) {
    const t = minima[level - 1];
    const last = thresholds[thresholds.length - 1];
    if (t > last) {
      thresholds.push(t);
      levels.push(level);
    } else {
      levels[levels.length - 1] = level;
    }
  }
  const maxPositive = positives[positives.length - 1];
  while (thresholds.length > 1 && thresholds[thresholds.length - 1] > maxPositive) {
    thresholds.pop();
    levels.pop();
  }
  return { thresholds, levels };
}
function levelOf(scale, count) {
  if (count <= 0) return 0;
  for (let i = scale.thresholds.length - 1; i >= 0; i--) {
    if (count >= scale.thresholds[i]) return scale.levels[i];
  }
  return 0;
}
function commitScaleLegendText(scale) {
  if (scale.thresholds.length === 1) return "0 commits";
  const parts = scale.thresholds.map(
    (t, i) => i === scale.thresholds.length - 1 ? `${t}+` : String(t)
  );
  return `${parts.join(" \xB7 ")} commits`;
}

// src/layout/structure.ts
var PAD_X = 26;
var HEADER_Y = 40;
var DIVIDER_Y = 49.5;
var WEEKDAY_Y = 76;
var FIRST_ROW_Y = 97;
var ROW_HEIGHT = 30;
var TREE_INDENT = 34;
var ICON_SIZE = 16;
var COLUMN_GAP = 32;
var HEATMAP_CELL = 12;
var HEATMAP_GAP = 8;
var CHANGES_SLOT = 20;
var CHANGES_BAR = 8;
var TREE_FONT = 13;
var NAME_TEXT_OFFSET = ICON_SIZE + 8;
var ROW_FONT_WEIGHT = 550;
var ROOT_FONT_WEIGHT = 650;
var DESC_FONT_WEIGHT = 400;
var DESC_FONT = 11;
var DESC_GAP = 8;
var META_GUTTER = 8;
var META_COL_GAP = 10;
var NUM_LABEL_GAP = 4;
var COUNT_FONT = 11;
function directoryNameWidth(name, depth) {
  return estimateTextWidth(name, {
    fontSize: TREE_FONT,
    mono: false,
    fontWeight: depth === 0 ? ROOT_FONT_WEIGHT : ROW_FONT_WEIGHT
  });
}
function descriptionWidth(text) {
  return estimateTextWidth(text, { fontSize: DESC_FONT, mono: false, fontWeight: DESC_FONT_WEIGHT });
}
function layoutStructure(data, enabled) {
  const contentLeft = PAD_X;
  const rowCount = data.rows.length;
  const days = data.days;
  const numText = (n) => String(n);
  const wordText = (n, one, many) => n === 1 ? one : many;
  const measure = (t) => estimateTextWidth(t, { fontSize: COUNT_FONT, mono: true });
  let maxTextEnd = 0;
  let dirsNumMax = 0;
  let dirsWordMax = 0;
  let filesNumMax = 0;
  let filesWordMax = 0;
  let shareMax = 0;
  for (const r of data.rows) {
    const nameW = directoryNameWidth(r.name, r.depth);
    const descW = r.description ? descriptionWidth(r.description) : 0;
    const contentEnd = NAME_TEXT_OFFSET + nameW + (r.description ? DESC_GAP + descW : 0);
    const textEnd = r.depth * TREE_INDENT + contentEnd;
    if (textEnd > maxTextEnd) maxTextEnd = textEnd;
    const dn = measure(numText(r.dirs));
    if (dn > dirsNumMax) dirsNumMax = dn;
    const dw = measure(wordText(r.dirs, "dir", "dirs"));
    if (dw > dirsWordMax) dirsWordMax = dw;
    const fn = measure(numText(r.files));
    if (fn > filesNumMax) filesNumMax = fn;
    const fw = measure(wordText(r.files, "file", "files"));
    if (fw > filesWordMax) filesWordMax = fw;
    if (r.codeShare != null) {
      const sw = measure(shareLabel(r.codeShare));
      if (sw > shareMax) shareMax = sw;
    }
  }
  if (data.rows.length === 0) {
    const headerW = estimateTextWidth("DIRECTORY", { fontSize: 12, mono: false });
    const footerW = estimateTextWidth("999,999,999 source files", { fontSize: 11, mono: false });
    maxTextEnd = Math.max(headerW, footerW);
    dirsNumMax = 0;
    dirsWordMax = 0;
    filesNumMax = 0;
    filesWordMax = 0;
    shareMax = 0;
  }
  const textRight = contentLeft + maxTextEnd;
  const metadataLeft = textRight + META_GUTTER;
  const dirsNumRight = metadataLeft + dirsNumMax;
  const dirsLabelX = dirsNumRight + NUM_LABEL_GAP;
  const sep1 = dirsLabelX + dirsWordMax + META_COL_GAP;
  const filesNumRight = sep1 + META_COL_GAP + filesNumMax;
  const filesLabelX = filesNumRight + NUM_LABEL_GAP;
  const sep2 = filesLabelX + filesWordMax + META_COL_GAP;
  const shareRight = sep2 + META_COL_GAP + shareMax;
  const treeWidth = shareRight - contentLeft;
  const commitsWidth = days * HEATMAP_CELL + (days - 1) * HEATMAP_GAP;
  const changesWidth = days * CHANGES_SLOT - 8;
  let cursor = contentLeft;
  const treeLeft = cursor;
  cursor += treeWidth;
  if (enabled.commits) cursor += COLUMN_GAP;
  const commitsLeft = cursor;
  if (enabled.commits) cursor += commitsWidth;
  if (enabled.changes) cursor += COLUMN_GAP;
  const changesLeft = cursor;
  if (enabled.changes) cursor += changesWidth;
  const contentRight = cursor;
  const cardWidth = contentRight + PAD_X;
  const tree = { enabled: true, left: treeLeft, width: treeWidth, centerX: treeLeft + treeWidth / 2 };
  const commits = { enabled: enabled.commits, left: commitsLeft, width: commitsWidth, centerX: commitsLeft + commitsWidth / 2 };
  const changes = { enabled: enabled.changes, left: changesLeft, width: changesWidth, centerX: changesLeft + changesWidth / 2 };
  const rows = data.rows.map((row, i) => {
    const iconLeft = contentLeft + row.depth * TREE_INDENT;
    const nameW = directoryNameWidth(row.name, row.depth);
    const rowLayout = {
      row,
      centerY: FIRST_ROW_Y + i * ROW_HEIGHT,
      iconLeft,
      nameLeft: iconLeft + NAME_TEXT_OFFSET,
      // Same global x for every row (anchor − iconLeft in the row-local space).
      dirsNumRightLocal: dirsNumRight - iconLeft,
      dirsLabelXLocal: dirsLabelX - iconLeft,
      filesNumRightLocal: filesNumRight - iconLeft,
      filesLabelXLocal: filesLabelX - iconLeft,
      sep1XLocal: sep1 - iconLeft,
      sep2XLocal: sep2 - iconLeft,
      shareRightXLocal: shareRight - iconLeft,
      countRight: shareRight,
      countRightLocal: shareRight - iconLeft
    };
    if (row.description) {
      rowLayout.descXLocal = NAME_TEXT_OFFSET + nameW + DESC_GAP;
    }
    return rowLayout;
  });
  const lastRowCenter = rowCount > 0 ? FIRST_ROW_Y + (rowCount - 1) * ROW_HEIGHT : FIRST_ROW_Y;
  const legendY = lastRowCenter + ROW_HEIGHT / 2 + 24;
  const cardHeight = legendY + 34;
  const positiveNonRootCounts = [];
  for (const r of data.rows) {
    if (r.repoRel === ".") continue;
    for (const d of r.activity) {
      if (d.commits > 0) positiveNonRootCounts.push(d.commits);
    }
  }
  const commitScale = buildCommitScale(positiveNonRootCounts);
  const commitLegendTextW = estimateTextWidth(commitScaleLegendText(commitScale), { fontSize: 11, mono: false });
  const swatchCount = commitScale.thresholds.length;
  const commitLegendWidth = (swatchCount - 1) * 14 + 20 + commitLegendTextW;
  const changesLegendWidth = 74 + estimateTextWidth("deleted", { fontSize: 11, mono: false });
  const commitLegend = { left: commits.centerX - commitLegendWidth / 2, centerX: commits.centerX, y: legendY };
  const changesLegend = { left: changes.centerX - changesLegendWidth / 2, centerX: changes.centerX, y: legendY };
  let maxCellCommits = 0;
  let maxAdditions = 0;
  let maxDeletions = 0;
  for (const r of data.rows) {
    for (const d of r.activity) {
      if (d.commits > maxCellCommits) maxCellCommits = d.commits;
      if (d.additions > maxAdditions) maxAdditions = d.additions;
      if (d.deletions > maxDeletions) maxDeletions = d.deletions;
    }
  }
  return {
    cardWidth,
    cardHeight,
    contentLeft,
    contentRight,
    columns: { tree, commits, changes },
    rows,
    weekdayLabels: resolveActivityHeader(days, data.startDate),
    commitLegend,
    changesLegend,
    footer: { x: tree.centerX, y: legendY + 2.5 },
    activityDays: days,
    commitScale,
    countAnchors: {
      dirsSlotLeft: metadataLeft,
      dirsNumRight,
      dirsLabelX,
      filesNumRight,
      filesLabelX,
      sep1,
      sep2,
      shareRight
    },
    maxCellCommits,
    maxAdditions,
    maxDeletions
  };
}
function changeBarHeight(value, maxValue) {
  if (value <= 0) return 0;
  const h = maxValue > 0 ? value / maxValue * 14 : 0;
  return Math.max(2, Math.round(h));
}
function changeBarOpacityIndex(height) {
  if (height >= 13) return 3;
  if (height >= 9) return 2;
  if (height >= 5) return 1;
  return 0;
}

// src/theme/color.ts
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
}
function rgbToHex(r, g, b) {
  const clamp = (n) => Math.round(Math.max(0, Math.min(255, n)));
  const to2 = (n) => clamp(n).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}
function mixHex(a, b, t) {
  const [r12, g1, b1] = hexToRgb(a);
  const [r22, g2, b2] = hexToRgb(b);
  return rgbToHex(r12 + (r22 - r12) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function oklchToHex(L, C, H) {
  const hr = H * Math.PI / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const conv = (c) => {
    const cc = Math.min(1, Math.max(0, c));
    return cc <= 31308e-7 ? 12.92 * cc : 1.055 * Math.pow(cc, 1 / 2.4) - 0.055;
  };
  return rgbToHex(conv(r) * 255, conv(g) * 255, conv(bb) * 255);
}
function rgbToOklch(hex) {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const rl = lin(r);
  const gl = lin(g);
  const bl = lin(b);
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const cb = (v) => v <= 0 ? 0 : Math.cbrt(v);
  const l_ = cb(l);
  const m_ = cb(m);
  const s_ = cb(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  const H = Math.atan2(bb, a) * 180 / Math.PI;
  return { L, C, H };
}
var TONE_DEEP = { lDelta: -0.11, cFactor: 0.88 };
var TONE_LIFT = { lDelta: 0.09, cFactor: 0.94 };
function deriveTone(hex, dir) {
  const { L, C, H } = rgbToOklch(hex);
  const { lDelta, cFactor } = dir === "deep" ? TONE_DEEP : TONE_LIFT;
  const lClamped = Math.min(0.95, Math.max(0.04, L + lDelta));
  return oklchToHex(lClamped, C * cFactor, H);
}

// src/structure/render.ts
function renderStructureCard(layout, theme, sourceFiles) {
  const p = theme.palette;
  const st = theme.structure;
  const { cardWidth, cardHeight } = layout;
  const hasDescriptions = layout.rows.some((r) => r.row.description !== void 0);
  const descFill = mixHex(p.text, p.surface, 0.55);
  const descStyle = hasDescriptions ? `
    .desc{fill:${descFill};font-size:${DESC_FONT}px;font-weight:${DESC_FONT_WEIGHT}}` : "";
  const enabledCommits = layout.columns.commits.enabled;
  const enabledChanges = layout.columns.changes.enabled;
  const cardRadius = theme.style.card.radius;
  const cardBorderW = theme.style.card.border_width;
  const heatRadius = theme.style.heatmap.radius;
  const borderInset = cardBorderW / 2;
  const headerItems = [];
  if (layout.columns.tree.enabled) headerItems.push(`<text x="${r1(layout.columns.tree.centerX)}" y="${HEADER_Y}" text-anchor="middle" class="label muted">DIRECTORY</text>`);
  if (enabledCommits) headerItems.push(`<text x="${r1(layout.columns.commits.centerX)}" y="${HEADER_Y}" text-anchor="middle" class="label muted">COMMITS</text>`);
  if (enabledChanges) headerItems.push(`<text x="${r1(layout.columns.changes.centerX)}" y="${HEADER_Y}" text-anchor="middle" class="label muted">CHANGES</text>`);
  const dividerX2 = enabledChanges ? layout.columns.changes.left + layout.columns.changes.width : enabledCommits ? layout.columns.commits.left + layout.columns.commits.width : layout.columns.tree.left + layout.columns.tree.width;
  const divider = `<line x1="${r1(layout.contentLeft)}" y1="${DIVIDER_Y}" x2="${r1(dividerX2)}" y2="${DIVIDER_Y}" stroke="${p.divider}"/>`;
  const labelX = (left, cellIndex) => left + cellIndex * (HEATMAP_CELL + HEATMAP_GAP) + HEATMAP_CELL / 2;
  const weekdayLabels = enabledCommits || enabledChanges ? layout.weekdayLabels.map((l) => {
    const xs = [];
    if (enabledCommits) xs.push(`<text x="${r1(labelX(layout.columns.commits.left, l.cellIndex))}" y="${WEEKDAY_Y}" class="small muted" text-anchor="middle">${escapeXml(l.label)}</text>`);
    if (enabledChanges) xs.push(`<text x="${r1(labelX(layout.columns.changes.left, l.cellIndex))}" y="${WEEKDAY_Y}" class="small muted" text-anchor="middle">${escapeXml(l.label)}</text>`);
    return xs.join("\n    ");
  }).join("\n    ") : "";
  const sectionLabel = `<text x="${r1(layout.contentLeft)}" y="${WEEKDAY_Y - 3.25}" class="small muted">STRUCTURE</text>`;
  const trunkX = (depth) => layout.contentLeft + depth * TREE_INDENT + ICON_SIZE / 2;
  const connectors = [];
  for (const row of layout.rows) {
    if (row.row.depth >= 1) {
      connectors.push(`M${r1(trunkX(row.row.depth - 1))} ${r1(row.centerY)} H${r1(row.iconLeft)}`);
    }
  }
  for (let i = 0; i < layout.rows.length; i++) {
    const row = layout.rows[i];
    const depth = row.row.depth;
    let lastChildCenter = null;
    for (let j = i + 1; j < layout.rows.length; j++) {
      const dj = layout.rows[j].row.depth;
      if (dj <= depth) break;
      if (dj === depth + 1) lastChildCenter = layout.rows[j].centerY;
    }
    if (lastChildCenter !== null) {
      connectors.push(`M${r1(trunkX(depth))} ${r1(row.centerY + 6)} V${r1(lastChildCenter)}`);
    }
  }
  const treeSvg = `<g class="tree">
    ${connectors.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>`;
  const dirRows = layout.rows.map((row) => {
    const descText = row.row.description !== void 0 && row.descXLocal !== void 0 ? `<text x="${r1(row.descXLocal)}" y="4.5" class="desc">${escapeXml(row.row.description)}</text>` : "";
    const dirsLabel = row.row.dirs === 1 ? "dir" : "dirs";
    const filesLabel = row.row.files === 1 ? "file" : "files";
    const share = row.row.codeShare != null ? `<text x="${r1(row.sep2XLocal)}" y="4.5" text-anchor="middle" class="small muted">\xB7</text><text x="${r1(row.shareRightXLocal)}" y="4.5" text-anchor="end" class="small muted mono">${escapeXml(shareLabel(row.row.codeShare))}</text>` : "";
    return `<g transform="translate(${r1(row.iconLeft)} ${r1(row.centerY)})"><path d="M0 -6h4.5l1.8 2H16v10H0z" fill="${st.folderFill}" stroke="${st.folderStroke}" stroke-width="1"/><text x="24" y="4.5" class="row${row.row.depth === 0 ? " root" : ""}">${escapeXml(row.row.name)}</text>${descText}<text x="${r1(row.dirsNumRightLocal)}" y="4.5" text-anchor="end" class="small muted mono">${row.row.dirs}</text><text x="${r1(row.dirsLabelXLocal)}" y="4.5" class="small muted mono">${dirsLabel}</text><text x="${r1(row.sep1XLocal)}" y="4.5" text-anchor="middle" class="small muted">\xB7</text><text x="${r1(row.filesNumRightLocal)}" y="4.5" text-anchor="end" class="small muted mono">${row.row.files}</text><text x="${r1(row.filesLabelXLocal)}" y="4.5" class="small muted mono">${filesLabel}</text>${share}</g>`;
  }).join("\n    ");
  const heatSvg = enabledCommits ? layout.rows.map(
    (row) => row.row.activity.map((day, di) => {
      const level = levelOf(layout.commitScale, day.commits);
      const x = layout.columns.commits.left + di * (HEATMAP_CELL + HEATMAP_GAP);
      const y = row.centerY - HEATMAP_CELL / 2;
      return `<rect x="${r1(x)}" y="${r1(y)}" width="${HEATMAP_CELL}" height="${HEATMAP_CELL}" rx="${r1(heatRadius)}" fill="${st.commitsColors[level]}" fill-opacity="${st.commitsIntensity[level]}" stroke="${st.commitsBorder}" stroke-width="1"/>`;
    }).join("")
  ).join("") : "";
  const changesSvg = enabledChanges ? layout.rows.map((row) => {
    let bars = "";
    bars += `<path d="M${r1(layout.columns.changes.left)} ${r1(row.centerY)}H${r1(layout.columns.changes.left + layout.columns.changes.width)}" fill="none" stroke="${st.changesBaseline}" stroke-width="1"/>`;
    for (let di = 0; di < row.row.activity.length; di++) {
      const day = row.row.activity[di];
      const x = layout.columns.changes.left + di * CHANGES_SLOT + 2;
      const addH = changeBarHeight(day.additions, layout.maxAdditions);
      const delH = changeBarHeight(day.deletions, layout.maxDeletions);
      const addOp = st.changesOpacity[changeBarOpacityIndex(addH)];
      const delOp = st.changesOpacity[changeBarOpacityIndex(delH)];
      if (addH > 0) bars += `<rect x="${r1(x)}" y="${r1(row.centerY - addH)}" width="${CHANGES_BAR}" height="${r1(addH)}" rx="2" fill="${st.changesAdded}" fill-opacity="${addOp}"/>`;
      if (delH > 0) bars += `<rect x="${r1(x)}" y="${r1(row.centerY)}" width="${CHANGES_BAR}" height="${r1(delH)}" rx="2" fill="${st.changesDeleted}" fill-opacity="${delOp}"/>`;
    }
    return bars;
  }).join("") : "";
  const commitLegend = enabledCommits ? (() => {
    const scale = layout.commitScale;
    const n = scale.thresholds.length;
    const swatches = Array.from({ length: n }, (_, i) => {
      const level = scale.levels[i];
      return `<rect x="${r1(i * 14)}" y="-5" width="10" height="10" rx="${r1(heatRadius)}" fill="${st.commitsColors[level]}" fill-opacity="${st.commitsIntensity[level]}" stroke="${st.commitsBorder}" stroke-width="1"/>`;
    }).join("");
    return `<g transform="translate(${r1(layout.commitLegend.left)} ${r1(layout.commitLegend.y)})">${swatches}<text x="${r1((n - 1) * 14 + 20)}" y="2.5" class="small muted">${escapeXml(commitScaleLegendText(layout.commitScale))}</text></g>`;
  })() : "";
  const changesLegend = enabledChanges ? `<g transform="translate(${r1(layout.changesLegend.left)} ${r1(layout.changesLegend.y)})"><rect x="0" y="-5" width="10" height="10" rx="${r1(heatRadius)}" fill="${st.changesAdded}"/><text x="16" y="2.5" class="small muted">added</text><rect x="58" y="-5" width="10" height="10" rx="${r1(heatRadius)}" fill="${st.changesDeleted}"/><text x="74" y="2.5" class="small muted">deleted</text></g>` : "";
  const footer = `<text x="${r1(layout.footer.x)}" y="${r1(layout.footer.y)}" text-anchor="middle" class="small muted">${escapeXml(`${sourceFiles} source files`)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cardWidth}" height="${cardHeight}" viewBox="0 0 ${cardWidth} ${cardHeight}" role="img" aria-labelledby="st-title st-desc">
  <title id="st-title">arte-git-card \xB7 Structure</title>
  <desc id="st-desc">Directory tree with ${layout.activityDays}-day commit and change activity.</desc>
  <style>
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:${p.text};text-rendering:geometricPrecision}
    .muted{fill:${p.text_muted}}
    .label{font-size:12px;font-weight:500;letter-spacing:0.08em}
    .small{font-size:11px}
    .row{font-size:${TREE_FONT}px;font-weight:${ROW_FONT_WEIGHT}}
    .root{font-weight:${ROOT_FONT_WEIGHT}}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
    .tree{stroke:${st.tree};stroke-width:1;fill:none}${descStyle}
  </style>

  <rect x="${r1(borderInset)}" y="${r1(borderInset)}" width="${r1(cardWidth - cardBorderW)}" height="${r1(cardHeight - cardBorderW)}" rx="${r1(cardRadius)}" stroke-width="${cardBorderW}" fill="${p.surface}" stroke="${p.border_muted}"/>

  <g class="label muted">
    ${headerItems.join("\n    ")}
  </g>

  ${divider}

  ${weekdayLabels}

  ${sectionLabel}

  ${treeSvg}

  <g>
    ${dirRows}
  </g>

  <g>
    ${heatSvg}
  </g>

  <g>
    ${changesSvg}
  </g>

  ${commitLegend}
  ${changesLegend}

  ${footer}
</svg>
`;
}

// src/display/builtin/structure/presenter.ts
function attachCodeShare(data, countedByDir, includeComments) {
  for (const row of data.rows) row.codeShare = codeShareOf(countedByDir, row.repoRel, includeComments);
  return data;
}
function attachStructureDescriptions(data, descriptions) {
  if (descriptions) {
    for (const row of data.rows) {
      if (Object.hasOwn(descriptions, row.repoRel)) {
        row.description = descriptions[row.repoRel];
      }
    }
  }
  return data;
}
function renderStructureDisplay(ctx) {
  const config = ctx.config;
  const anchor = config.activity_anchor ?? "recent";
  const tree = legacyView(
    ctx.statistics.get(treeStatistics, {
      root: config.root,
      maxDepth: config.max_depth
    })
  );
  const activity = legacyView(
    ctx.statistics.get(activityStatistics, { days: config.activity_days, anchor })
  );
  const theme = legacyView(ctx.theme);
  const wholeRepo = !config.root || config.root.trim() === ".";
  const repoName = wholeRepo && config.repositoryName ? config.repositoryName : null;
  const structureData = buildStructureData(tree, activity, config.activity_days, ctx.now, repoName);
  const codebase = ctx.statistics.get(codebaseStatistics);
  attachCodeShare(structureData, codebase.countedByDir, config.codeIncludeComments === true);
  attachStructureDescriptions(structureData, config.descriptions);
  const layout = layoutStructure(structureData, {
    commits: config.commits.enabled,
    changes: config.changes.enabled
  });
  return renderStructureCard(layout, theme, codebase.analyzedSourceFiles);
}

// src/display/builtin/structure/definition.ts
var structureSchema = external_exports.object({
  enabled: external_exports.boolean(),
  root: external_exports.string(),
  max_depth: external_exports.number().int().min(1).max(5),
  activity_days: activityDaysSchema,
  activity_anchor: external_exports.enum(["recent", "last-activity"]).optional(),
  commits: external_exports.object({ enabled: external_exports.boolean() }).strict(),
  changes: external_exports.object({ enabled: external_exports.boolean() }).strict()
}).strict();
var intRange = (key, min, max) => (c, raw) => parseIntegerRange(raw, min, max, key);
var structureDisplay = defineLegacySvgDisplay({
  id: "structure",
  title: "Structure",
  config: {
    schema: structureSchema,
    defaults: () => ({
      enabled: false,
      root: ".",
      max_depth: 3,
      activity_days: 7,
      commits: { enabled: true },
      changes: { enabled: true }
    }),
    requiredInSchemaV2: true,
    settings: [
      {
        key: "root",
        type: "safe-relative-path",
        description: "Visual tree root (project-relative directory)",
        read: (c) => c.root,
        apply: (c, raw) => {
          c.root = raw;
        },
        reset: (c) => {
          c.root = ".";
        }
      },
      {
        key: "max-depth",
        type: "integer 1..5",
        description: "Tree render depth (1..5; the repo root row is level 0 and does not consume it)",
        read: (c) => c.max_depth,
        apply: (c, raw) => {
          c.max_depth = intRange("structure.max-depth", 1, 5)(c, raw);
        },
        reset: (c) => {
          c.max_depth = 3;
        }
      },
      {
        key: "activity-days",
        type: "integer 7|14|30",
        description: "Git activity window in days",
        read: (c) => c.activity_days,
        apply: (c, raw) => {
          c.activity_days = parseEnumValue(raw, [7, 14, 30], "structure.activity-days");
        },
        reset: (c) => {
          c.activity_days = 7;
        }
      },
      {
        key: "activity-anchor",
        type: "recent|last-activity",
        description: "Activity window anchor (recent ends today; last-activity ends on the latest commit day)",
        read: (c) => c.activity_anchor ?? "recent",
        apply: (c, raw) => {
          c.activity_anchor = parseEnumValue(raw, ["recent", "last-activity"], "structure.activity-anchor");
        },
        reset: (c) => {
          delete c.activity_anchor;
        }
      },
      {
        key: "commits.enabled",
        type: "boolean",
        description: "Show commits heatmap",
        read: (c) => c.commits.enabled,
        apply: (c, raw) => {
          c.commits.enabled = parseBool(raw, "structure.commits.enabled");
        },
        reset: (c) => {
          c.commits.enabled = true;
        }
      },
      {
        key: "changes.enabled",
        type: "boolean",
        description: "Show changes microbars",
        read: (c) => c.changes.enabled,
        apply: (c, raw) => {
          c.changes.enabled = parseBool(raw, "structure.changes.enabled");
        },
        reset: (c) => {
          c.changes.enabled = true;
        }
      }
    ]
  },
  template: (ctx) => renderStructureDisplay(ctx)
});

// src/display/registry.ts
var DISPLAY_ID_RE = /^[a-z][a-z0-9-]{0,47}$/;
var SETTING_KEY_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
var RESERVED_IDS = /* @__PURE__ */ new Set(["preview", "state", "workflow", "ci", "txn"]);
function assertValidRegistry(entries) {
  const ids = /* @__PURE__ */ new Set();
  const files = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (!DISPLAY_ID_RE.test(entry.id)) {
      throw new Error(`display registry: invalid display id "${entry.id}"`);
    }
    if (RESERVED_IDS.has(entry.id) || entry.id.startsWith(".")) {
      throw new Error(`display registry: reserved display id "${entry.id}"`);
    }
    if (ids.has(entry.id)) throw new Error(`display registry: duplicate display id "${entry.id}"`);
    ids.add(entry.id);
    const file = `${entry.id}.svg`;
    if (files.has(file)) throw new Error(`display registry: duplicate output filename "${file}"`);
    files.add(file);
    if (entry.id === "preview") throw new Error("display registry: 'preview' is reserved");
    const defaults = entry.config.defaults();
    const parsed = entry.config.schema.safeParse(defaults);
    if (!parsed.success) {
      throw new Error(
        `display registry: display "${entry.id}" defaults do not satisfy its own schema: ` + parsed.error.issues.map((i) => `\`${i.path.join(".") || "defaults"}\`: ${i.message}`).join("; ")
      );
    }
    const defaultEnabled = defaults.enabled;
    if (defaultEnabled !== false) {
      throw new Error(
        `display registry: display "${entry.id}" defaults must set enabled:false (enabled is lifecycle-managed by \`arte-gitcard add\` / \`arte-gitcard remove\`)`
      );
    }
    const seenSettings = /* @__PURE__ */ new Set();
    for (const setting of entry.config.settings) {
      if (!SETTING_KEY_RE.test(setting.key)) {
        throw new Error(
          `display registry: display "${entry.id}" has an invalid setting key "${setting.key}" (expected lowercase kebab segments like "commits.enabled")`
        );
      }
      if (setting.key === "enabled") {
        throw new Error(
          `display registry: display "${entry.id}" declares setting key "enabled" \u2014 "enabled" is lifecycle-managed by \`arte-gitcard add\` / \`arte-gitcard remove\`.`
        );
      }
      if (seenSettings.has(setting.key)) {
        throw new Error(`display registry: display "${entry.id}" declares duplicate setting key "${setting.key}"`);
      }
      seenSettings.add(setting.key);
    }
  }
}
var DISPLAY_REGISTRY = Object.freeze(
  [codebaseDisplay, structureDisplay].map((d) => Object.freeze(d))
);
assertValidRegistry(DISPLAY_REGISTRY);
function displayFilename(id) {
  return `${id}.svg`;
}
function registryDisplayIds(registry) {
  return registry.map((d) => d.id);
}
function registryDisplayFilenames(registry) {
  return registry.map((d) => displayFilename(d.id));
}
function registryEnabledDisplays(registry, config) {
  const cards = config.cards;
  const out = [];
  for (const definition of registry) {
    const cardConfig = cards[definition.id];
    if (displayEnabledIn(config, definition.id)) {
      out.push({ id: definition.id, file: displayFilename(definition.id), definition, config: cardConfig });
    }
  }
  return out;
}

// src/runtime.ts
function createArteRuntime(input) {
  assertValidRegistry(input.displays);
  const displays = Object.freeze([...input.displays].map((d) => Object.freeze(d)));
  const settings = composeConfigKeys(displays);
  const seenKeys = /* @__PURE__ */ new Set();
  for (const spec of settings) {
    if (seenKeys.has(spec.key)) {
      throw new Error(
        `runtime: config-key collision on "${spec.key}" \u2014 a Display setting shadows a framework/other key. Use a distinct display id/setting name.`
      );
    }
    seenKeys.add(spec.key);
  }
  const runtime = {
    displays,
    config: Object.freeze({
      v2Schema: buildV2Schema(displays),
      settings: Object.freeze(settings)
    }),
    cardIds: Object.freeze(registryDisplayIds(displays)),
    cardFilenames: Object.freeze(registryDisplayFilenames(displays)),
    findDisplay: (id) => displays.find((d) => d.id === id),
    enabledDisplays: (config) => registryEnabledDisplays(displays, config)
  };
  return Object.freeze(runtime);
}
var DEFAULT_RUNTIME = createArteRuntime({ displays: DISPLAY_REGISTRY });

// src/fs/hash.ts
var import_node_crypto = require("crypto");
var import_node_fs6 = require("fs");
function sha256Content(content) {
  return (0, import_node_crypto.createHash)("sha256").update(content).digest("hex");
}
function sha256File(abs) {
  try {
    return sha256Content((0, import_node_fs6.readFileSync)(abs));
  } catch {
    return null;
  }
}

// src/config/load.ts
var ConfigError = class extends Error {
  configPath;
  reason;
  constructor(message, configPath, reason = "strict-fail") {
    super(message);
    this.name = "ConfigError";
    this.configPath = configPath;
    this.reason = reason;
  }
};
function formatZodError(err) {
  return err.issues.map((issue) => {
    const field = issue.path.length > 0 ? `\`${issue.path.join(".")}\`` : "config";
    return `${field}: ${issue.message}`;
  }).join("\n");
}
function loadConfigWithSchema(configPath, schema) {
  let bytes;
  try {
    bytes = (0, import_node_fs7.readFileSync)(configPath);
  } catch (err) {
    throw new ConfigError(`cannot read config file: ${configPath}`, configPath, "invalid-yaml");
  }
  const raw = bytes.toString("utf8");
  let parsed;
  try {
    const value = import_yaml.default.parse(raw);
    parsed = value === null || typeof value !== "object" || Array.isArray(value) ? {} : value;
  } catch (err) {
    throw new ConfigError(`invalid YAML in ${configPath}`, configPath, "invalid-yaml");
  }
  const version = parsed["schema-version"];
  if (version === void 0) {
    throw new ConfigError(
      `This is a legacy v1 config (no "schema-version"). Run "arte-gitcard migrate" to upgrade to arte-gitcard v2.`,
      configPath,
      "v1"
    );
  }
  if (version !== 2) {
    throw new ConfigError(
      `Unsupported schema-version ${JSON.stringify(version)} in ${configPath}. This arte-gitcard version supports schema-version 2.`,
      configPath,
      "unsupported-version"
    );
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(
      `Invalid configuration (${configPath}):
${formatZodError(result.error)}`,
      configPath,
      "strict-fail"
    );
  }
  return {
    config: result.data,
    projectRoot: projectRootOf(configPath),
    configPath,
    // Hash the EXACT bytes that were parsed (a precondition source, not a re-read).
    sourceSha256: sha256Content(bytes)
  };
}
function loadConfig(configPath) {
  return loadConfigWithSchema(configPath, DEFAULT_RUNTIME.config.v2Schema);
}

// src/theme/load.ts
var import_node_fs8 = require("fs");
var import_node_path7 = __toESM(require("path"));
var import_yaml2 = __toESM(require_dist());

// src/util/merge.ts
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function deepMerge(base, source) {
  if (!isPlainObject(source)) {
    return source === void 0 ? base : source;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(source)) {
    const existing = out[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      out[key] = deepMerge(existing, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// src/theme/default-theme.ts
var DEFAULT_THEME = {
  name: "arte-theme",
  palette: {
    surface: "#F2EFE5",
    surface_muted: "#E9E4D8",
    text: "#4A4742",
    text_muted: "#777168",
    border_muted: "#C8C1B5",
    divider: "#D7D0C3",
    accent: "#D77655",
    accent_soft: "#E5A18A",
    neutral: "#A49E94",
    positive: "#74866D",
    negative: "#D77655",
    data_palette: {
      families: [
        { name: "Rose", base: "#A86D76" },
        { name: "Clay", base: "#AD6D5D" },
        { name: "Ochre", base: "#A37547" },
        { name: "Olive", base: "#8B7D47" },
        { name: "Moss", base: "#708250" },
        { name: "Sage", base: "#5E8D6E" },
        { name: "Teal", base: "#4A877F" },
        { name: "Petrol", base: "#448594" },
        { name: "Slate", base: "#5682A7" },
        { name: "Indigo", base: "#6E77A4" },
        { name: "Plum", base: "#84709C" },
        { name: "Wine", base: "#96698C" }
      ]
    }
  },
  style: {
    card: { radius: 16, border_width: 1 },
    bar: { radius: 2 },
    heatmap: { radius: 3 }
  },
  codebase: {
    effective: "accent",
    comments: "accent_soft",
    blank: "neutral",
    languages: { color_mode: "palette" },
    fan: {
      color: "accent",
      fill_opacity: { start: 0.16, end: 0.03 },
      // Hide the fan's side edges by default (theme-controlled visibility).
      edge_stroke_opacity: 0
    }
  },
  structure: {
    tree: "border_muted",
    folder: { fill: "surface_muted", stroke: "text_muted" },
    commits: {
      // arte: one warm hue shaded by opacity; level 0 is the empty-cell fill.
      colors: ["surface_muted", "accent", "accent", "accent", "accent"],
      intensity: [1, 0.22, 0.42, 0.66, 0.92],
      // Cell border from the theme palette (light stroke color).
      border: "border_muted"
    },
    changes: {
      added: "positive",
      deleted: "negative",
      baseline: "border_muted",
      opacity: [0.45, 0.65, 0.85, 1]
    }
  }
};

// src/theme/github-theme.ts
var GITHUB_THEME = {
  name: "github-theme",
  palette: {
    surface: "#FFFFFF",
    surface_muted: "#F6F8FA",
    text: "#1F2328",
    text_muted: "#656D76",
    border_muted: "#D0D7DE",
    divider: "#D8DEE4",
    accent: "#0969DA",
    accent_soft: "#54AEFF",
    neutral: "#6E7781",
    positive: "#2DA44E",
    negative: "#E5534B",
    data_palette: {
      families: [
        { name: "Blue", base: "#3178C6" },
        { name: "Yellow", base: "#F1E05A" },
        { name: "Cyan", base: "#00ADD8" },
        { name: "Tan", base: "#DEA584" },
        { name: "Brown", base: "#B07219" },
        { name: "Pink", base: "#F34B7D" },
        { name: "Green", base: "#178600" },
        { name: "Maroon", base: "#701516" },
        { name: "Vermilion", base: "#F05138" },
        { name: "Violet", base: "#A97BFF" },
        { name: "Indigo", base: "#563D7C" },
        { name: "Teal", base: "#384D54" }
      ]
    }
  },
  style: {
    card: { radius: 16, border_width: 1 },
    bar: { radius: 2 },
    heatmap: { radius: 3 }
  },
  codebase: {
    effective: "accent",
    comments: "accent_soft",
    blank: "neutral",
    languages: { color_mode: "palette" },
    fan: {
      color: "accent",
      fill_opacity: { start: 0.16, end: 0.03 },
      // Hide the fan's side edges by default (theme-controlled visibility).
      edge_stroke_opacity: 0
    }
  },
  structure: {
    tree: "border_muted",
    folder: { fill: "surface_muted", stroke: "text_muted" },
    commits: {
      // GitHub contribution-graph green ramp (solid cells, GitHub palette).
      colors: ["#EFF2F5", "#ACEEBB", "#4AC26B", "#2DA44E", "#116329"],
      intensity: [1, 1, 1, 1, 1],
      border: "#E5E8EB"
    },
    changes: {
      added: "positive",
      deleted: "negative",
      baseline: "border_muted",
      opacity: [0.45, 0.65, 0.85, 1]
    }
  }
};

// src/theme/schema.ts
var HEX_NO_ALPHA_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
var HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/;
var TOKEN_RE = /^[a-z][a-z0-9_]*$/;
function isConcreteHex(value) {
  return HEX_NO_ALPHA_RE.test(value);
}
function isColorRef(value) {
  return HEX_RE.test(value) || TOKEN_RE.test(value);
}
var concreteHex = external_exports.string().refine(isConcreteHex, {
  message: "must be a concrete #RGB / #RRGGBB hex color (no semantic token, no alpha)"
});
var colorRef = external_exports.string().refine(isColorRef, {
  message: "must be a semantic palette token or #RGB / #RRGGBB / #RRGGBBAA hex"
});
var opacity = external_exports.number().min(0).max(1);
var nonNegative = external_exports.number().min(0);
var familySchema = external_exports.object({
  name: external_exports.string().min(1),
  base: concreteHex
}).strict();
var dataPaletteSchema = external_exports.object({
  families: external_exports.array(familySchema).length(12)
}).strict();
var themeSchema = external_exports.object({
  name: external_exports.string().optional(),
  palette: external_exports.object({
    surface: concreteHex,
    surface_muted: concreteHex,
    text: concreteHex,
    text_muted: concreteHex,
    border_muted: concreteHex,
    divider: concreteHex,
    accent: concreteHex,
    accent_soft: concreteHex,
    neutral: concreteHex,
    positive: concreteHex,
    negative: concreteHex,
    data_palette: dataPaletteSchema
  }).strict(),
  style: external_exports.object({
    card: external_exports.object({ radius: nonNegative, border_width: nonNegative }).strict(),
    bar: external_exports.object({ radius: nonNegative }).strict(),
    heatmap: external_exports.object({ radius: nonNegative }).strict()
  }).strict(),
  codebase: external_exports.object({
    effective: colorRef,
    comments: colorRef,
    blank: colorRef,
    languages: external_exports.object({
      color_mode: external_exports.union([external_exports.literal("palette"), external_exports.literal("monochrome")])
    }).strict(),
    fan: external_exports.object({
      color: colorRef,
      fill_opacity: external_exports.object({ start: opacity, end: opacity }).strict(),
      /** Opacity of the fan's side edge strokes; 0 hides them (built-in default). */
      edge_stroke_opacity: opacity
    }).strict()
  }).strict(),
  structure: external_exports.object({
    tree: colorRef,
    folder: external_exports.object({ fill: colorRef, stroke: colorRef }).strict(),
    commits: external_exports.object({
      colors: external_exports.array(colorRef).length(5),
      /** Per-level opacity (GitHub solid; arte: one hue shaded by opacity). */
      intensity: external_exports.array(opacity).length(5),
      border: colorRef
    }).strict(),
    changes: external_exports.object({
      added: colorRef,
      deleted: colorRef,
      baseline: colorRef,
      /** 4-level bar opacity ramp (value/max bucketed). */
      opacity: external_exports.array(opacity).length(4).optional()
    }).strict()
  }).strict()
}).strict();

// src/theme/load.ts
var ThemeError = class extends Error {
  themePath;
  constructor(message, themePath) {
    super(message);
    this.name = "ThemeError";
    this.themePath = themePath;
  }
};
var BUILTIN_THEMES = {
  "arte-theme": DEFAULT_THEME,
  "github-theme": GITHUB_THEME
};
function loadTheme(themePath, projectRoot) {
  const builtin = BUILTIN_THEMES[themePath];
  if (builtin) return builtin;
  const resolved = import_node_path7.default.isAbsolute(themePath) ? themePath : import_node_path7.default.resolve(projectRoot, themePath);
  let raw;
  try {
    raw = (0, import_node_fs8.readFileSync)(resolved, "utf8");
  } catch (err) {
    throw new ThemeError(`cannot read theme file: ${resolved}`, resolved);
  }
  let parsed;
  try {
    parsed = import_yaml2.default.parse(raw) ?? {};
  } catch (err) {
    throw new ThemeError(`invalid YAML in ${resolved}`, resolved);
  }
  const merged = deepMerge(DEFAULT_THEME, parsed);
  const result = themeSchema.safeParse(merged);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `\`${i.path.join(".") || "theme"}\`: ${i.message}`).join("\n");
    throw new ThemeError(`Invalid theme (${resolved}):
${msg}`, resolved);
  }
  return result.data;
}

// src/theme/resolve.ts
var HEX_RE2 = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/;
function resolveToken(token, palette) {
  const value = palette[token];
  if (typeof value === "string") return value;
  if (HEX_RE2.test(token)) return token;
  throw new Error(`Unknown theme token: "${token}"`);
}
var HUE_INTERLEAVE_ORDER = [0, 6, 3, 9, 1, 5, 10, 2, 7, 11, 4, 8];
function resolveTheme(theme) {
  const p = theme.palette;
  const families = p.data_palette.families;
  const base12 = HUE_INTERLEAVE_ORDER.map((i) => families[i].base);
  const deep12 = base12.map((hex) => deriveTone(hex, "deep"));
  const lift12 = base12.map((hex) => deriveTone(hex, "lift"));
  return {
    name: theme.name ?? "theme",
    palette: p,
    style: theme.style,
    codebase: {
      effective: resolveToken(theme.codebase.effective, p),
      comments: resolveToken(theme.codebase.comments, p),
      blank: resolveToken(theme.codebase.blank, p),
      colorMode: theme.codebase.languages.color_mode,
      fanColor: resolveToken(theme.codebase.fan.color, p),
      fanFillStart: theme.codebase.fan.fill_opacity.start,
      fanFillEnd: theme.codebase.fan.fill_opacity.end,
      fanEdgeStrokeOpacity: theme.codebase.fan.edge_stroke_opacity
    },
    structure: {
      tree: resolveToken(theme.structure.tree, p),
      folderFill: resolveToken(theme.structure.folder.fill, p),
      folderStroke: resolveToken(theme.structure.folder.stroke, p),
      commitsColors: theme.structure.commits.colors.map((c) => resolveToken(c, p)),
      commitsIntensity: theme.structure.commits.intensity,
      commitsBorder: resolveToken(theme.structure.commits.border, p),
      changesAdded: resolveToken(theme.structure.changes.added, p),
      changesDeleted: resolveToken(theme.structure.changes.deleted, p),
      changesBaseline: resolveToken(theme.structure.changes.baseline, p),
      changesOpacity: theme.structure.changes.opacity ?? [0.45, 0.65, 0.85, 1]
    },
    dataColors: dataColorsFor(theme)
  };
}
function dataColorsFor(theme) {
  const mode = theme.codebase.languages.color_mode;
  if (mode === "monochrome") {
    const accent = resolveToken(theme.codebase.fan.color, theme.palette);
    return Array.from({ length: 36 }, (_, i) => mixHex(accent, "#4A4742", i / 35 * 0.6));
  }
  const families = theme.palette.data_palette.families;
  const base12 = HUE_INTERLEAVE_ORDER.map((i) => families[i].base);
  const deep12 = base12.map((hex) => deriveTone(hex, "deep"));
  const lift12 = base12.map((hex) => deriveTone(hex, "lift"));
  return [...base12, ...deep12, ...lift12];
}

// src/state/guards.ts
var import_node_path9 = __toESM(require("path"));

// src/fs/pathguard.ts
var import_node_fs9 = require("fs");
var import_node_path8 = __toESM(require("path"));
function normalizeRelPosix(rel) {
  if (!rel || rel.length === 0) return null;
  if (rel.startsWith("/")) return null;
  if (rel.startsWith("\\")) return null;
  if (/^[A-Za-z]:[\\/]/.test(rel)) return null;
  if (rel.includes("\\")) return null;
  const segments = rel.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") return null;
  }
  return segments.join("/");
}
function isPathInside(child, parent) {
  const c = import_node_path8.default.resolve(child);
  const p = import_node_path8.default.resolve(parent);
  return c === p || c.startsWith(p + import_node_path8.default.sep);
}
function resolveContained(repoRoot, relPosix) {
  const rel = normalizeRelPosix(relPosix);
  if (!rel) return null;
  const abs = import_node_path8.default.resolve(repoRoot, rel);
  if (!isPathInside(abs, repoRoot)) return null;
  return abs;
}
function pathHasNoSymlinkComponents(repoRoot, relPosix) {
  const abs = resolveContained(repoRoot, relPosix);
  if (!abs) return false;
  const rel = import_node_path8.default.relative(repoRoot, abs);
  if (rel === "") return true;
  const parts = rel.split(import_node_path8.default.sep);
  let cur = repoRoot;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    cur = import_node_path8.default.join(cur, part);
    let st;
    try {
      st = (0, import_node_fs9.lstatSync)(cur);
    } catch (err) {
      const code = err?.code;
      return code === "ENOENT";
    }
    if (st.isSymbolicLink()) return false;
    const last = i === parts.length - 1;
    if (!last && !st.isDirectory()) return false;
  }
  return true;
}
function realpathContained(repoRoot, relPosix) {
  const abs = resolveContained(repoRoot, relPosix);
  if (!abs) return null;
  let rootReal;
  try {
    rootReal = (0, import_node_fs9.realpathSync)(repoRoot);
  } catch {
    return null;
  }
  const rel = import_node_path8.default.relative(repoRoot, abs);
  if (rel === "") return rootReal;
  let cur = rootReal;
  for (const part of rel.split(import_node_path8.default.sep)) {
    if (!part) continue;
    cur = import_node_path8.default.join(cur, part);
    let st;
    try {
      st = (0, import_node_fs9.lstatSync)(cur);
    } catch {
      return abs;
    }
    if (st.isSymbolicLink()) {
      let target;
      try {
        target = (0, import_node_fs9.realpathSync)(cur);
      } catch {
        return null;
      }
      if (!isPathInside(target, rootReal)) return null;
      cur = target;
    }
  }
  return abs;
}

// src/managed/paths.ts
var STATE_REL = ".arte-git-card/state.json";
var WORKFLOW_REL = ".github/workflows/arte-gitcard.yml";
var CI_ACTION_REL = ".arte-git-card/ci/action.yml";
var CI_RUNTIME_REL = ".arte-git-card/ci/main.cjs";
var STRUCTURE_DESCRIPTIONS_REL = ".arte-git-card/structure-descriptions.json";
var THEMES_DIR_REL = ".arte-git-card/themes";
var JOURNAL_REL = ".arte-git-card/txn.json";
var PREVIEW_FILENAME = "preview.html";

// src/state/guards.ts
function toPosix(p) {
  return p.replace(/\\/g, "/");
}
function isThemeRel(rel) {
  const prefix = `${THEMES_DIR_REL}/`;
  if (!rel.startsWith(prefix) || !rel.endsWith(".yml")) return false;
  const name = rel.slice(prefix.length, rel.length - 4);
  if (!name) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name.startsWith(".")) return false;
  return true;
}
function underAnyDir(rel, dirs, file) {
  for (const dir of dirs) {
    if (rel === `${dir}/${file}`) return true;
  }
  return false;
}
function isCardRel(rel, dirs, filenames) {
  return filenames.some((f) => underAnyDir(rel, dirs, f));
}
function isPreviewRel(rel, dirs) {
  return underAnyDir(rel, dirs, PREVIEW_FILENAME);
}
function buildManagedGuard(projectRoot, config, opts = {}) {
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const cardFilenames = runtime.cardFilenames;
  const dirs = /* @__PURE__ */ new Set();
  const add = (dir) => {
    const normalized = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalized && normalizeRelPosix(normalized)) dirs.add(normalized);
  };
  if (config) {
    const abs = import_node_path9.default.isAbsolute(config.output.directory) ? config.output.directory : import_node_path9.default.resolve(projectRoot, config.output.directory);
    add(toPosix(import_node_path9.default.relative(projectRoot, abs)));
  }
  for (const d of opts.outputDirs ?? []) add(d);
  return (ctx) => {
    const rel = normalizeRelPosix(ctx.rel);
    if (!rel) return false;
    const kind = ctx.kind;
    switch (kind) {
      case "config":
        return rel === CONFIG_FILENAME;
      case "state":
        return rel === STATE_REL;
      case "workflow":
        return rel === WORKFLOW_REL;
      case "ci-action":
        return rel === CI_ACTION_REL;
      case "ci-runtime":
        return rel === CI_RUNTIME_REL;
      case "structure-descriptions":
        return rel === STRUCTURE_DESCRIPTIONS_REL;
      case "theme":
        return isThemeRel(rel);
      case "card":
        return isCardRel(rel, dirs, cardFilenames);
      case "preview":
        return isPreviewRel(rel, dirs);
      default:
        return false;
    }
  };
}

// src/state/registry.ts
var import_node_fs10 = require("fs");
var import_node_path10 = __toESM(require("path"));

// src/version.ts
var VERSION = "1.0.0";

// src/state/registry.ts
var StateError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StateError";
  }
};
var CollisionError = class extends Error {
  path;
  constructor(message, path22) {
    super(message);
    this.name = "CollisionError";
    this.path = path22;
  }
};
var MANAGED_KIND_VALUES = [
  "card",
  "preview",
  "workflow",
  "ci-action",
  "ci-runtime",
  "theme"
];
var stateEntrySchema = external_exports.object({
  path: external_exports.string(),
  kind: external_exports.enum(MANAGED_KIND_VALUES),
  sha256: external_exports.string().regex(/^[0-9a-f]{64}$/)
}).strict();
var stateSchema = external_exports.object({
  schemaVersion: external_exports.literal(2),
  toolVersion: external_exports.string(),
  managedFiles: external_exports.array(stateEntrySchema),
  outputRoots: external_exports.array(external_exports.string()),
  github: external_exports.object({ defaultBranch: external_exports.string().optional() }).strict().optional()
}).strict();
function statePath(projectRoot) {
  return import_node_path10.default.join(projectRoot, STATE_REL);
}
function readState(projectRoot) {
  const p = statePath(projectRoot);
  if (!pathHasNoSymlinkComponents(projectRoot, STATE_REL)) return { status: "corrupt", path: p, sha256: null };
  let buf;
  try {
    buf = (0, import_node_fs10.readFileSync)(p);
  } catch (err) {
    const code = err?.code;
    if (code === "ENOENT") return { status: "missing", path: p };
    return { status: "corrupt", path: p, sha256: null };
  }
  const raw = buf.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupt", path: p, sha256: sha256Content(buf) };
  }
  if (parsed && typeof parsed === "object" && typeof parsed["schemaVersion"] === "number" && parsed["schemaVersion"] !== 2) {
    return { status: "incompatible", path: p, sha256: sha256Content(buf) };
  }
  const result = stateSchema.safeParse(parsed);
  if (!result.success) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
  const state = result.data;
  const seenPaths = /* @__PURE__ */ new Set();
  for (const e of state.managedFiles) {
    const normalized = normalizeRelPosix(e.path);
    if (!normalized) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    if (seenPaths.has(normalized)) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    seenPaths.add(normalized);
  }
  const seenRoots = /* @__PURE__ */ new Set();
  for (const root of state.outputRoots) {
    const normalized = normalizeRelPosix(root);
    if (!normalized) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    if (seenRoots.has(normalized)) return { status: "corrupt", path: p, sha256: sha256Content(buf) };
    seenRoots.add(normalized);
  }
  return { status: "ok", state, path: p, sha256: sha256Content(buf) };
}
function serializeState(state) {
  const managedFiles = [...state.managedFiles].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const outputRoots = [...state.outputRoots].sort();
  const doc = {
    schemaVersion: 2,
    toolVersion: VERSION,
    managedFiles,
    outputRoots
  };
  if (state.github) doc.github = { defaultBranch: state.github.defaultBranch };
  return JSON.stringify(doc, null, 2) + "\n";
}
function findEntry(state, rel) {
  return state.managedFiles.find((e) => e.path === rel);
}
function upsertEntry(state, entry) {
  const idx = state.managedFiles.findIndex((e) => e.path === entry.path);
  if (idx >= 0) state.managedFiles[idx] = entry;
  else state.managedFiles.push(entry);
}
function removeEntry(state, rel) {
  state.managedFiles = state.managedFiles.filter((e) => e.path !== rel);
}
function assertDeletable(projectRoot, entry) {
  const abs = resolveContained(projectRoot, entry.path);
  if (!abs) return "unsafe";
  if (!realpathContained(projectRoot, entry.path)) return "unsafe";
  let st;
  try {
    st = (0, import_node_fs10.lstatSync)(abs);
  } catch (err) {
    const code = err?.code;
    return code === "ENOENT" ? "missing" : "unsafe";
  }
  if (st.isSymbolicLink() || !st.isFile()) return "unsafe";
  const cur = sha256File(abs);
  if (cur === null) return "unsafe";
  return cur === entry.sha256 ? "ok" : "modified";
}

// src/generate/manage.ts
var import_node_path20 = __toESM(require("path"));
var import_node_fs18 = require("fs");
var import_yaml3 = __toESM(require_dist());

// src/fs/atomic.ts
var import_node_fs11 = require("fs");
var import_node_crypto2 = require("crypto");
var import_node_path11 = __toESM(require("path"));
function normalizeLf(content) {
  return content.replace(/\r\n/g, "\n");
}
var AGC_TEMP_NAME_RE = /^\.agc-\d+-[0-9a-f]{12}$/;
function isAgcTempName(basename) {
  return AGC_TEMP_NAME_RE.test(basename);
}
function sha256WrittenContent(content) {
  return sha256Content(normalizeLf(content));
}
function stageFile(targetAbs, content) {
  (0, import_node_fs11.mkdirSync)(import_node_path11.default.dirname(targetAbs), { recursive: true });
  const stagingAbs = import_node_path11.default.join(
    import_node_path11.default.dirname(targetAbs),
    `.agc-${process.pid}-${(0, import_node_crypto2.randomBytes)(6).toString("hex")}`
  );
  const lf = normalizeLf(content);
  (0, import_node_fs11.writeFileSync)(stagingAbs, lf, { encoding: "utf8" });
  return { stagingAbs, sha256: sha256Content(lf) };
}
function commitStaged(stagingAbs, targetAbs) {
  renameWithRetry(stagingAbs, targetAbs);
}
function writeFileAtomic(abs, content) {
  const staged = stageFile(abs, content);
  try {
    commitStaged(staged.stagingAbs, abs);
  } catch (err) {
    try {
      (0, import_node_fs11.unlinkSync)(staged.stagingAbs);
    } catch {
    }
    throw err;
  }
}
function renameWithRetry(src, dest) {
  const attempts = 3;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      (0, import_node_fs11.renameSync)(src, dest);
      return;
    } catch (err) {
      lastErr = err;
      const code = err?.code;
      const transient = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      if (!transient || i === attempts - 1) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw lastErr;
}
function atomicRemove(abs) {
  try {
    (0, import_node_fs11.unlinkSync)(abs);
  } catch (err) {
    const code = err?.code;
    if (code === "ENOENT") return;
    throw err;
  }
}

// src/txn/engine.ts
var import_node_fs15 = require("fs");
var import_node_path16 = __toESM(require("path"));

// src/fs/authority.ts
var import_node_path13 = __toESM(require("path"));

// src/fs/lock.ts
var import_node_fs12 = require("fs");
var import_node_os = __toESM(require("os"));
var import_node_path12 = __toESM(require("path"));

// src/util/sleep.ts
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// src/fs/lock.ts
var DEFAULT_STALE_MS = 10 * 60 * 1e3;
var DEFAULT_WAIT_MS = 10 * 1e3;
var DEFAULT_POLL_MS = 200;
function acquireRepoLock(lockPath, command, opts = {}) {
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS;
  const waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const dir = import_node_path12.default.dirname(lockPath);
  const anchor = findExistingAnchor(dir);
  if (anchor !== dir) (0, import_node_fs12.mkdirSync)(dir, { recursive: true });
  const token = { pid: process.pid, host: import_node_os.default.hostname(), time: Date.now(), command };
  const tokenJson = JSON.stringify(token);
  const deadline = Date.now() + waitMs;
  for (; ; ) {
    try {
      const fd = (0, import_node_fs12.openSync)(lockPath, "wx");
      (0, import_node_fs12.writeFileSync)(fd, tokenJson);
      (0, import_node_fs12.closeSync)(fd);
      break;
    } catch (err) {
      const code = err?.code;
      if (code !== "EEXIST") {
        cleanupCreatedDirs(dir, anchor);
        throw err;
      }
      const holder = readHolder(lockPath);
      const mtime = statMtime(lockPath);
      if (isStale(holder, mtime, staleMs)) {
        try {
          (0, import_node_fs12.unlinkSync)(lockPath);
        } catch (err2) {
          const code2 = err2?.code;
          if (code2 === "ENOENT") {
          } else {
            cleanupCreatedDirs(dir, anchor);
            throw new Error(
              `Repository lock at ${lockPath} is stale but could not be removed (${code2 ?? "unknown error"}). It may be a directory or otherwise protected. Remove it manually and retry.`
            );
          }
        }
        continue;
      }
      if (Date.now() >= deadline) {
        cleanupCreatedDirs(dir, anchor);
        const info = holder ? `pid ${holder.pid} on host "${holder.host}" since ${new Date(holder.time).toISOString()} (${holder.command})` : "an unreadable lock file";
        throw new Error(
          `Repository is locked (${info}). Stale locks are auto-broken after ${Math.round(staleMs / 6e4)} minutes. Wait for the other arte-gitcard process to finish, or remove the lock file manually.`
        );
      }
      sleepSync(pollMs);
    }
  }
  return {
    token,
    release: () => releaseRepoLock(lockPath, token, dir, anchor)
  };
}
function readHolder(lockPath) {
  try {
    const parsed = JSON.parse((0, import_node_fs12.readFileSync)(lockPath, "utf8"));
    if (parsed && typeof parsed.pid === "number" && typeof parsed.host === "string") {
      return {
        pid: parsed.pid,
        host: parsed.host,
        time: typeof parsed.time === "number" ? parsed.time : 0,
        command: typeof parsed.command === "string" ? parsed.command : "unknown"
      };
    }
  } catch {
  }
  return null;
}
function statMtime(lockPath) {
  try {
    return (0, import_node_fs12.statSync)(lockPath).mtimeMs;
  } catch {
    return null;
  }
}
function isStale(holder, mtime, staleMs) {
  if (holder) {
    if (holder.host === import_node_os.default.hostname()) {
      return !pidAlive(holder.pid);
    }
    return Date.now() - holder.time > staleMs;
  }
  return mtime !== null && Date.now() - mtime > staleMs;
}
function pidAlive(pid) {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}
function releaseRepoLock(lockPath, token, dir, anchor) {
  try {
    const current = readHolder(lockPath);
    if (current && current.pid === token.pid && current.host === token.host) {
      (0, import_node_fs12.unlinkSync)(lockPath);
    }
  } catch {
  }
  cleanupCreatedDirs(dir, anchor);
}
function findExistingAnchor(dir) {
  let cur = dir;
  for (; ; ) {
    if ((0, import_node_fs12.existsSync)(cur)) return cur;
    const parent = import_node_path12.default.dirname(cur);
    if (parent === cur) return cur;
    cur = parent;
  }
}
function cleanupCreatedDirs(dir, anchor) {
  let cur = dir;
  while (cur !== anchor && import_node_path12.default.dirname(cur) !== cur) {
    try {
      if ((0, import_node_fs12.readdirSync)(cur).length === 0) (0, import_node_fs12.rmdirSync)(cur);
      else break;
    } catch {
      break;
    }
    cur = import_node_path12.default.dirname(cur);
  }
}

// src/fs/authority.ts
var PathAuthorityError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PathAuthorityError";
  }
};
function assertStrictContained(repoRoot, relPosix) {
  const abs = resolveContained(repoRoot, relPosix);
  if (!abs) {
    throw new PathAuthorityError(`unsafe path (outside the repository): ${relPosix}`);
  }
  if (!pathHasNoSymlinkComponents(repoRoot, relPosix)) {
    throw new PathAuthorityError(
      `refusing to traverse a symlink/junction component: ${relPosix} \u2014 arte-gitcard never follows symlinks for mutation or control paths`
    );
  }
}
function acquireRepoLockAuthoritative(repoRoot, lockPath, command, opts = {}) {
  const rel = import_node_path13.default.relative(repoRoot, lockPath).split(import_node_path13.default.sep).join("/");
  assertStrictContained(repoRoot, rel);
  return acquireRepoLock(lockPath, command, opts);
}

// src/txn/journal.ts
var import_node_crypto3 = require("crypto");
var import_node_fs13 = require("fs");
var import_node_path14 = __toESM(require("path"));
function buildJournal(repoRoot, ops) {
  return { schemaVersion: 1, id: (0, import_node_crypto3.randomBytes)(8).toString("hex"), repoRoot, ops };
}
function writeJournal(journalPath, journal) {
  writeFileAtomic(journalPath, JSON.stringify(journal, null, 2) + "\n");
}
var JOURNAL_SCHEMA_VERSION = 1;
var JOURNAL_OPS = /* @__PURE__ */ new Set(["write", "delete", "state"]);
function parseJournalTop(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.schemaVersion === JOURNAL_SCHEMA_VERSION && typeof parsed.repoRoot === "string" && Array.isArray(parsed.ops)) {
      return parsed;
    }
  } catch {
  }
  return null;
}
function validJournalOps(ops) {
  if (!Array.isArray(ops)) return false;
  for (const op of ops) {
    if (!op || typeof op !== "object") return false;
    const o = op;
    if (typeof o.kind !== "string") return false;
    if (typeof o.rel !== "string") return false;
    if (typeof o.op !== "string" || !JOURNAL_OPS.has(o.op)) return false;
    for (const k of ["beforeSha256", "afterSha256", "stagingRel", "stagingSha256"]) {
      const v = o[k];
      if (v !== null && typeof v !== "string") return false;
    }
  }
  return true;
}
function inspectJournal(journalPath, expectedRepoRoot) {
  let st;
  try {
    st = (0, import_node_fs13.lstatSync)(journalPath);
  } catch (err) {
    const code = err?.code;
    if (code === "ENOENT") return { present: false };
    return { present: true, state: "unreadable" };
  }
  if (st.isSymbolicLink() || !st.isFile()) return { present: true, state: "unreadable" };
  let raw;
  try {
    raw = (0, import_node_fs13.readFileSync)(journalPath, "utf8");
  } catch {
    return { present: true, state: "unreadable" };
  }
  const parsed = parseJournalTop(raw);
  if (!parsed) return { present: true, state: "corrupt" };
  if (!validJournalOps(parsed.ops)) return { present: true, state: "incompatible" };
  if (expectedRepoRoot !== void 0 && import_node_path14.default.resolve(parsed.repoRoot) !== import_node_path14.default.resolve(expectedRepoRoot)) {
    return { present: true, state: "mismatch" };
  }
  return { present: true, state: "clean" };
}
function readJournal(journalPath) {
  let raw;
  try {
    raw = (0, import_node_fs13.readFileSync)(journalPath, "utf8");
  } catch {
    return null;
  }
  return parseJournalTop(raw);
}
function removeJournal(journalPath) {
  atomicRemove(journalPath);
}

// src/txn/recover.ts
var import_node_path15 = __toESM(require("path"));
var import_node_fs14 = require("fs");
function validateStaged(repoRoot, finalAbs, stagingRel, afterSha256) {
  if (!resolveContained(repoRoot, stagingRel)) return null;
  try {
    assertStrictContained(repoRoot, stagingRel);
  } catch {
    return null;
  }
  const stagingAbs = import_node_path15.default.resolve(repoRoot, stagingRel);
  if (import_node_path15.default.dirname(stagingAbs) !== import_node_path15.default.dirname(finalAbs)) return null;
  if (!isAgcTempName(import_node_path15.default.basename(stagingAbs))) return null;
  let st;
  try {
    st = (0, import_node_fs14.lstatSync)(stagingAbs);
  } catch {
    return null;
  }
  if (st.isSymbolicLink() || !st.isFile()) return null;
  if (sha256File(stagingAbs) !== afterSha256) return null;
  return { abs: stagingAbs };
}
function probeDisk(abs) {
  let st;
  try {
    st = (0, import_node_fs14.lstatSync)(abs);
  } catch (err) {
    const code = err?.code;
    return code === "ENOENT" ? { kind: "absent" } : { kind: "unreadable" };
  }
  if (st.isSymbolicLink() || !st.isFile()) return { kind: "unreadable" };
  const sha = sha256File(abs);
  return sha === null ? { kind: "unreadable" } : { kind: "file", sha };
}
function recoverJournal(repoRoot, opts = {}) {
  const journalPath = opts.journalPath ?? import_node_path15.default.join(repoRoot, ".arte-git-card", "txn.json");
  const inspection = inspectJournal(journalPath, repoRoot);
  if (!inspection.present) return { recovered: false, preserved: [], journalPresent: false };
  if (inspection.state !== "clean") {
    return { recovered: false, preserved: [], journalPresent: true };
  }
  const journal = readJournal(journalPath);
  const preserved = [];
  for (const op of journal.ops) {
    const abs = resolveContained(repoRoot, op.rel);
    if (!abs) {
      preserved.push(op.rel);
      break;
    }
    if (opts.guard && !opts.guard({ kind: op.kind, rel: op.rel })) {
      preserved.push(op.rel);
      break;
    }
    try {
      assertStrictContained(repoRoot, op.rel);
    } catch {
      preserved.push(op.rel);
      break;
    }
    const probe = probeDisk(abs);
    if (probe.kind === "unreadable") {
      preserved.push(op.rel);
      break;
    }
    const current = probe.kind === "absent" ? null : probe.sha;
    if (op.op === "write" || op.op === "state") {
      if (current === op.afterSha256) continue;
      const finalStillBefore = current === op.beforeSha256 || op.beforeSha256 === null && current === null;
      if (finalStillBefore && op.stagingRel && op.afterSha256 !== null) {
        const staged = validateStaged(repoRoot, abs, op.stagingRel, op.afterSha256);
        if (staged) {
          let content;
          try {
            content = (0, import_node_fs14.readFileSync)(staged.abs, "utf8");
          } catch {
            content = "";
          }
          if (sha256Content(content) === op.afterSha256) {
            writeFileAtomic(abs, content);
            try {
              atomicRemove(staged.abs);
            } catch {
            }
            continue;
          }
        }
      }
      preserved.push(op.rel);
      break;
    } else {
      if (current === null) continue;
      if (current === op.beforeSha256) {
        atomicRemove(abs);
        continue;
      }
      preserved.push(op.rel);
      break;
    }
  }
  if (preserved.length === 0) {
    removeJournal(journalPath);
    return { recovered: true, preserved: [], journalPresent: false };
  }
  return { recovered: true, preserved, journalPresent: true };
}

// src/txn/engine.ts
var TxnError = class extends Error {
};
function guardPath(opts, kind, rel) {
  if (opts.guard && !opts.guard({ kind, rel })) {
    throw new TxnError(`path is not managed by arte-gitcard: ${rel}`);
  }
}
function prepareWrite(repoRoot, opts, dryRun, stagingToClean, writes, w) {
  guardPath(opts, w.kind, w.rel);
  const abs = resolveContained(repoRoot, w.rel);
  if (!abs || abs !== import_node_path16.default.resolve(w.abs)) {
    throw new TxnError(`unsafe or inconsistent write path: ${w.rel}`);
  }
  assertStrictContained(repoRoot, w.rel);
  assertExpectedBefore(repoRoot, w);
  const beforeSha256 = sha256File(abs);
  const mode = beforeSha256 === null ? "create" : "replace";
  const afterSha256 = sha256Content(normalizeLf(w.content));
  if (mode === "replace" && beforeSha256 === afterSha256) {
    return;
  }
  let staged = null;
  if (!dryRun) {
    staged = stageFile(abs, w.content);
    stagingToClean.push(staged.stagingAbs);
  }
  writes.push({ rel: w.rel, abs, kind: w.kind, mode, beforeSha256, afterSha256, staged });
}
function prepareDelete(repoRoot, opts, d) {
  guardPath(opts, d.kind, d.rel);
  const abs = resolveContained(repoRoot, d.rel);
  if (!abs || abs !== import_node_path16.default.resolve(d.abs)) {
    throw new TxnError(`unsafe or inconsistent delete path: ${d.rel}`);
  }
  assertStrictContained(repoRoot, d.rel);
  let st;
  try {
    st = (0, import_node_fs15.lstatSync)(abs);
  } catch (err) {
    const code = err?.code;
    if (code === "ENOENT") return { rel: d.rel, abs, kind: d.kind, expectedSha256: d.expectedSha256, missing: true };
    throw new TxnError(`cannot delete ${d.rel}: the target exists but could not be verified (preserving).`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new TxnError(`refusing to delete a non-regular file (preserving): ${d.rel}`);
  }
  const cur = sha256File(abs);
  if (cur === null) {
    throw new TxnError(`cannot delete ${d.rel}: the file exists but could not be read/verified (preserving).`);
  }
  if (cur !== d.expectedSha256) {
    throw new TxnError(
      `cannot delete ${d.rel}: file no longer matches the arte-gitcard-managed hash (preserving). It was probably modified after generation.`
    );
  }
  return { rel: d.rel, abs, kind: d.kind, expectedSha256: d.expectedSha256, missing: false };
}
function toRepoRel(repoRoot, abs) {
  return import_node_path16.default.relative(repoRoot, abs).split(import_node_path16.default.sep).join("/");
}
function assertExpectedBefore(repoRoot, w) {
  if (!w.expectedBefore) return;
  const abs = resolveContained(repoRoot, w.rel);
  if (!abs) throw new TxnError(`unsafe write path: ${w.rel}`);
  if (w.expectedBefore.kind === "absent") {
    let exists = false;
    try {
      (0, import_node_fs15.lstatSync)(abs);
      exists = true;
    } catch (err) {
      const code = err?.code;
      if (code !== "ENOENT") {
        throw new TxnError(`cannot verify write target ${w.rel} (fail closed, preserving).`);
      }
    }
    if (exists) {
      throw new TxnError(
        `${w.rel} appeared after planning (expected absent) \u2014 preserved, not overwritten. Retry the command.`
      );
    }
    return;
  }
  let st;
  try {
    st = (0, import_node_fs15.lstatSync)(abs);
  } catch {
    throw new TxnError(`${w.rel} is missing though it was expected present \u2014 preserved (changed concurrently).`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new TxnError(`${w.rel} is not a regular file \u2014 preserved, not overwritten (changed concurrently).`);
  }
  const cur = sha256File(abs);
  if (cur === null) {
    throw new TxnError(`cannot verify write target ${w.rel} (fail closed, preserving).`);
  }
  if (cur !== w.expectedBefore.sha256) {
    throw new TxnError(`${w.rel} changed after planning \u2014 preserved, not overwritten. Retry the command.`);
  }
}
function concurrentError(rel, detail) {
  throw new TxnError(
    `${rel} changed concurrently (${detail}) \u2014 no changes were made. Retry the command.`
  );
}
function verifyPrecondition(repoRoot, pc) {
  try {
    assertStrictContained(repoRoot, pc.rel);
  } catch (err) {
    throw new TxnError(`precondition path is unsafe: ${err.message}`);
  }
  const abs = resolveContained(repoRoot, pc.rel);
  if (pc.kind === "sha256") {
    let st;
    try {
      st = (0, import_node_fs15.lstatSync)(abs);
    } catch (err) {
      const code = err?.code;
      if (code === "ENOENT") concurrentError(pc.rel, "file is absent");
      throw new TxnError(`cannot verify ${pc.rel}: the target exists but could not be read (fail closed, preserving).`);
    }
    if (st.isSymbolicLink() || !st.isFile()) {
      throw new TxnError(`cannot verify ${pc.rel}: the target is not a regular file (fail closed, preserving).`);
    }
    const cur = sha256File(abs);
    if (cur === null) {
      throw new TxnError(`cannot verify ${pc.rel}: the file exists but could not be hashed (fail closed, preserving).`);
    }
    if (cur !== pc.expectedSha256) concurrentError(pc.rel, "hash mismatch");
    return;
  }
  try {
    (0, import_node_fs15.lstatSync)(abs);
  } catch (err) {
    const code = err?.code;
    if (code === "ENOENT") return;
    throw new TxnError(`cannot verify ${pc.rel}: absence could not be established (fail closed, preserving).`);
  }
  concurrentError(pc.rel, "target now exists");
}
function assertWritableNow(opts, w) {
  guardPath(opts, w.kind, w.rel);
  const abs = resolveContained(opts.repoRoot, w.rel);
  if (!abs || abs !== import_node_path16.default.resolve(w.abs)) {
    throw new TxnError(`write target changed or is unsafe at apply time: ${w.rel}`);
  }
  try {
    assertStrictContained(opts.repoRoot, w.rel);
  } catch (err) {
    throw new TxnError(`write target path became unsafe (symlink/junction component) at apply time: ${w.rel} (${err.message})`);
  }
  if (!w.staged) throw new TxnError(`staging missing at apply time for ${w.rel}`);
  let st;
  try {
    st = (0, import_node_fs15.lstatSync)(w.staged.stagingAbs);
  } catch {
    throw new TxnError(`staging file vanished at apply time for ${w.rel}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new TxnError(`staging file is no longer a regular file at apply time for ${w.rel}`);
  }
  if (w.mode === "create") {
    let exists = false;
    try {
      (0, import_node_fs15.lstatSync)(w.abs);
      exists = true;
    } catch (err) {
      const code = err?.code;
      if (code !== "ENOENT") {
        throw new TxnError(`cannot verify write target ${w.rel} at apply time (fail closed, preserving).`);
      }
    }
    if (exists) {
      throw new TxnError(`write race: ${w.rel} appeared between prepare and apply (preserving). Retry the command.`);
    }
  } else if (sha256File(w.abs) !== w.beforeSha256) {
    throw new TxnError(
      `write race: ${w.rel} changed between prepare and apply (preserving). It was not silently overwritten. Run "arte-gitcard doctor" to inspect.`
    );
  }
}
function assertDeletableNow(opts, d) {
  guardPath(opts, d.kind, d.rel);
  const abs = resolveContained(opts.repoRoot, d.rel);
  if (!abs || abs !== import_node_path16.default.resolve(d.abs)) {
    throw new TxnError(`delete target changed or is unsafe at apply time: ${d.rel}`);
  }
  try {
    assertStrictContained(opts.repoRoot, d.rel);
  } catch (err) {
    throw new TxnError(`delete target became unsafe (symlink/junction component) at apply time: ${d.rel} (${err.message})`);
  }
  if (sha256File(d.abs) !== d.expectedSha256) {
    throw new TxnError(
      `delete race: ${d.rel} changed between prepare and apply (preserving). Run "arte-gitcard doctor" to inspect.`
    );
  }
}
function runTransaction(plan, opts) {
  const repoRoot = import_node_path16.default.resolve(opts.repoRoot);
  const dryRun = opts.dryRun === true;
  const acquire = !dryRun && opts.acquireLock !== false;
  const lockPath = opts.lockPath ?? import_node_path16.default.join(repoRoot, ".arte-git-card", ".lock");
  const journalPath = opts.journalPath ?? import_node_path16.default.join(repoRoot, ".arte-git-card", "txn.json");
  let lock = null;
  if (acquire) {
    lock = acquireRepoLockAuthoritative(repoRoot, lockPath, opts.command, opts.lock);
  }
  try {
    if (lock && opts.recoverFirst !== false) {
      const inspection = inspectJournal(journalPath, repoRoot);
      if (inspection.present) {
        if (inspection.state !== "clean") {
          throw new TxnError(
            `An existing transaction journal at ${journalPath} is ${inspection.state} and cannot be safely verified or recovered. It was PRESERVED as evidence \u2014 arte-gitcard will not overwrite it. Inspect it (or remove it) manually, or run "arte-gitcard doctor".`
          );
        }
        const result = recoverJournal(repoRoot, {
          repoRoot,
          journalPath,
          guard: opts.guard
        });
        if (result.preserved.length > 0) {
          throw new TxnError(
            `Interrupted transaction could not be recovered safely. User changes detected \u2014 preserved paths:
` + result.preserved.map((p) => `  ${p}`).join("\n") + `
Run "arte-gitcard doctor" for details before retrying.`
          );
        }
      }
    }
    for (const pc of plan.preconditions ?? []) {
      verifyPrecondition(repoRoot, pc);
    }
    const writes = [];
    const stagingToClean = [];
    const deletes = [];
    try {
      for (const w of plan.writes) {
        prepareWrite(repoRoot, opts, dryRun, stagingToClean, writes, w);
      }
      if (plan.stateJson) {
        prepareWrite(repoRoot, opts, dryRun, stagingToClean, writes, {
          rel: plan.stateJson.rel,
          abs: import_node_path16.default.join(repoRoot, plan.stateJson.rel),
          content: plan.stateJson.content,
          kind: "state"
        });
      }
      for (const d of plan.deletes) {
        deletes.push(prepareDelete(repoRoot, opts, d));
      }
    } catch (err) {
      for (const s of stagingToClean) {
        try {
          atomicRemove(s);
        } catch {
        }
      }
      throw err;
    }
    const effects = [];
    for (const w of writes) {
      if (w.kind === "state") continue;
      effects.push({ type: "write", rel: w.rel, kind: w.kind, mode: w.mode });
    }
    for (const d of deletes) {
      if (!d.missing) effects.push({ type: "delete", rel: d.rel, kind: d.kind });
    }
    if (plan.stateJson && writes.some((w) => w.kind === "state")) {
      effects.push({ type: "state", rel: plan.stateJson.rel });
    }
    if (dryRun) return { effects };
    const journalOps = [];
    for (const w of writes) {
      if (w.kind === "state") continue;
      journalOps.push(opToJournal(repoRoot, w, "write"));
    }
    for (const d of deletes) {
      if (d.missing) continue;
      journalOps.push({
        kind: d.kind,
        rel: d.rel,
        op: "delete",
        beforeSha256: d.expectedSha256,
        afterSha256: null,
        stagingRel: null,
        stagingSha256: null
      });
    }
    for (const w of writes) {
      if (w.kind !== "state") continue;
      journalOps.push(opToJournal(repoRoot, w, "state"));
    }
    if (journalOps.length > 0) {
      writeJournal(journalPath, buildJournal(repoRoot, journalOps));
    }
    let appliedAny = false;
    try {
      for (const w of writes) {
        if (w.kind === "state") continue;
        assertWritableNow(opts, w);
        commitStaged(w.staged.stagingAbs, w.abs);
        appliedAny = true;
      }
      for (const d of deletes) {
        if (d.missing) continue;
        assertDeletableNow(opts, d);
        atomicRemove(d.abs);
        appliedAny = true;
      }
      for (const w of writes) {
        if (w.kind !== "state") continue;
        assertWritableNow(opts, w);
        commitStaged(w.staged.stagingAbs, w.abs);
        appliedAny = true;
      }
    } catch (err) {
      if (!appliedAny) {
        for (const s of stagingToClean) {
          try {
            atomicRemove(s);
          } catch {
          }
        }
        try {
          removeJournal(journalPath);
        } catch {
        }
      }
      throw err;
    }
    removeJournal(journalPath);
    return { effects };
  } finally {
    if (lock) lock.release();
  }
}
function opToJournal(repoRoot, w, op) {
  return {
    kind: w.kind,
    rel: w.rel,
    op,
    beforeSha256: w.beforeSha256,
    afterSha256: w.afterSha256,
    stagingRel: w.staged ? toRepoRel(repoRoot, w.staged.stagingAbs) : null,
    stagingSha256: w.staged ? w.staged.sha256 : null
  };
}

// src/txn/plan.ts
function emptyPlan() {
  return { writes: [], deletes: [], stateJson: null, preconditions: [] };
}

// src/output/preview.ts
function buildPreviewHtml(cards) {
  const cardsHtml = cards.map(
    (c) => `<div class="card"><div class="cap">${escapeXml(c.file)}</div>${c.svg}</div>`
  ).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>arte-git-card \xB7 Preview</title>
<style>
  body{margin:32px;background:#f4f2ec;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
  h1{font-size:18px;color:#333}
  .card{display:inline-block;margin:12px;background:#fff;padding:18px;border-radius:20px;box-shadow:0 4px 18px rgba(0,0,0,.08);vertical-align:top}
  .cap{margin:0 0 12px;font-size:13px;font-weight:600;color:#555;font-family:ui-monospace,Menlo,Consolas,monospace}
</style>
</head>
<body>
<h1>arte-git-card \xB7 Preview</h1>
${cardsHtml}
</body>
</html>
`;
}

// src/generate/plan.ts
var import_node_path18 = __toESM(require("path"));

// src/languages/builtin.ts
var C_STRINGS = ['"', "'", "`"];
var BUILTIN_LANGUAGES = [
  { id: "typescript", name: "TypeScript", extensions: [".ts", ".tsx", ".mts", ".cts"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: C_STRINGS } },
  { id: "javascript", name: "JavaScript", extensions: [".js", ".jsx", ".mjs", ".cjs"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: C_STRINGS } },
  { id: "python", name: "Python", extensions: [".py", ".pyw"], shebang: ["python", "python3"], syntax: { lineComment: ["#"], blockComment: [["'''", "'''"], ['"""', '"""']], strings: ["'", '"'] } },
  { id: "rust", name: "Rust", extensions: [".rs"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "go", name: "Go", extensions: [".go"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "`"] } },
  { id: "shell", name: "Shell", extensions: [".sh", ".bash", ".zsh", ".fish"], shebang: ["sh", "bash", "zsh", "fish"], syntax: { lineComment: ["#"], strings: ['"', "'", "`"] } },
  { id: "java", name: "Java", extensions: [".java"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "c", name: "C", extensions: [".c", ".h"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "cpp", name: "C++", extensions: [".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "csharp", name: "C#", extensions: [".cs"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "ruby", name: "Ruby", extensions: [".rb"], shebang: ["ruby"], syntax: { lineComment: ["#"], blockComment: [["=begin", "=end"]], strings: ['"', "'"] } },
  { id: "php", name: "PHP", extensions: [".php"], syntax: { lineComment: ["//", "#"], blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "swift", name: "Swift", extensions: [".swift"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "kotlin", name: "Kotlin", extensions: [".kt", ".kts"], syntax: { lineComment: ["//"], blockComment: [["/*", "*/"]], strings: ['"'] } },
  { id: "html", name: "HTML", extensions: [".html", ".htm"], syntax: { blockComment: [["<!--", "-->"]], strings: ['"', "'"] } },
  { id: "css", name: "CSS", extensions: [".css"], syntax: { blockComment: [["/*", "*/"]], strings: ['"', "'"] } },
  { id: "markdown", name: "Markdown", extensions: [".md", ".markdown"], syntax: { blockComment: [["<!--", "-->"]], strings: [] } },
  { id: "json", name: "JSON", extensions: [".json"], syntax: { strings: ['"'] } },
  { id: "yaml", name: "YAML", extensions: [".yml", ".yaml"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
  { id: "toml", name: "TOML", extensions: [".toml"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
  { id: "sql", name: "SQL", extensions: [".sql"], syntax: { lineComment: ["--"], blockComment: [["/*", "*/"]], strings: ["'"] } },
  { id: "dockerfile", name: "Dockerfile", filenames: ["Dockerfile", "Containerfile"], syntax: { lineComment: ["#"], strings: ['"', "'"] } },
  { id: "makefile", name: "Makefile", filenames: ["Makefile", "makefile", "GNUmakefile"], syntax: { lineComment: ["#"] } },
  { id: "cmake", name: "CMake", filenames: ["CMakeLists.txt"], extensions: [".cmake"], syntax: { lineComment: ["#"], strings: ['"', "'"] } }
];
var BUILTIN_BY_EXT = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const lang of BUILTIN_LANGUAGES) {
    for (const ext of lang.extensions ?? []) m.set(ext.toLowerCase(), lang);
  }
  return m;
})();
var BUILTIN_BY_FILENAME = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const lang of BUILTIN_LANGUAGES) {
    for (const name of lang.filenames ?? []) m.set(name.toLowerCase(), lang);
  }
  return m;
})();

// src/languages/registry.ts
var EMPTY_SYNTAX = {};
function buildRegistry(customRules) {
  if (!customRules || customRules.length === 0) return BUILTIN_LANGUAGES;
  const byId = /* @__PURE__ */ new Map();
  for (const lang of BUILTIN_LANGUAGES) byId.set(lang.id, lang);
  for (const rule of customRules) {
    const existing = byId.get(rule.id);
    const base = existing?.syntax ?? EMPTY_SYNTAX;
    const syntax = {
      lineComment: rule.comments?.line !== void 0 ? rule.comments.line : base.lineComment,
      blockComment: rule.comments?.block !== void 0 ? rule.comments.block : base.blockComment,
      strings: base.strings
    };
    byId.set(rule.id, {
      id: rule.id,
      name: rule.name ?? existing?.name,
      extensions: rule.extensions ?? existing?.extensions,
      filenames: rule.filenames ?? existing?.filenames,
      shebang: rule.shebang ?? existing?.shebang,
      syntax
    });
  }
  return [...byId.values()];
}
function buildRegistryIndex(languages) {
  const byExt = /* @__PURE__ */ new Map();
  const byFilename = /* @__PURE__ */ new Map();
  const byId = /* @__PURE__ */ new Map();
  for (const lang of languages) {
    byId.set(lang.id, lang);
    for (const ext of lang.extensions ?? []) byExt.set(ext.toLowerCase(), lang);
    for (const name of lang.filenames ?? []) byFilename.set(name.toLowerCase(), lang);
  }
  return { languages, byExt, byFilename, byId };
}

// src/structure/descriptions.ts
var import_node_fs16 = require("fs");
var import_node_path17 = __toESM(require("path"));
var MAX_DESC_CODEPOINTS = 20;
var STORE_SCHEMA_VERSION = 1;
var StructureDescriptionsError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StructureDescriptionsError";
  }
};
function storePath(projectRoot) {
  return import_node_path17.default.join(projectRoot, STRUCTURE_DESCRIPTIONS_REL);
}
function containsLineBreak(value) {
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 10 || cp === 13 || cp === 8232 || cp === 8233) return true;
  }
  return false;
}
function containsIllegalXmlCodePoint(value) {
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 9 || cp === 10 || cp === 13) continue;
    if (cp >= 32 && cp <= 55295) continue;
    if (cp >= 57344 && cp <= 65533) continue;
    if (cp >= 65536 && cp <= 1114111) continue;
    return true;
  }
  return false;
}
function isToolInternalKey(key) {
  return key === ".git" || key.startsWith(".git/") || key === ".arte-git-card" || key.startsWith(".arte-git-card/");
}
function descriptionKeyError(key) {
  if (!key || key === ".") return "key must be a non-empty repository-relative directory path";
  if (key.startsWith("/") || /^[A-Za-z]:[\\/]/.test(key) || key.startsWith("\\")) {
    return "key must be a repository-relative path (no absolute/drive/UNC paths)";
  }
  if (key.includes("\\")) return "key must use POSIX separators";
  const norm = normalizeRelPosix(key);
  if (!norm || norm !== key) {
    return "key must be a canonical POSIX path (no ./ prefix, no trailing /, no //, no ..)";
  }
  if (isToolInternalKey(key)) return `key must not point inside the tool's own directory (${key})`;
  return null;
}
function descriptionValueError(text) {
  if (text.length === 0) return "description must not be empty";
  if (text !== text.trim()) return "description must not start or end with whitespace";
  for (const ch of text) if (ch === "	") return "description must not contain a tab";
  if (containsLineBreak(text)) return "description must not contain a line break";
  if (containsIllegalXmlCodePoint(text)) return "description contains a character invalid in XML 1.0";
  if (Array.from(text).length > MAX_DESC_CODEPOINTS) {
    return `description exceeds ${MAX_DESC_CODEPOINTS} code points`;
  }
  return null;
}
function readStructureDescriptions(projectRoot) {
  const abs = storePath(projectRoot);
  if (!pathHasNoSymlinkComponents(projectRoot, STRUCTURE_DESCRIPTIONS_REL)) {
    throw new StructureDescriptionsError(
      `${STRUCTURE_DESCRIPTIONS_REL} traverses a symlink/junction component \u2014 refusing to read it (fail closed).`
    );
  }
  let st;
  try {
    st = (0, import_node_fs16.lstatSync)(abs);
  } catch (err) {
    const code = err?.code;
    if (code === "ENOENT") return { status: "absent" };
    throw new StructureDescriptionsError(
      `cannot read ${STRUCTURE_DESCRIPTIONS_REL}: the file exists but could not be verified (fail closed). Run \`arte-gitcard doctor\`.`
    );
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new StructureDescriptionsError(
      `${STRUCTURE_DESCRIPTIONS_REL} is a ${st.isSymbolicLink() ? "symbolic link" : "non-regular file"} \u2014 refusing to read it (fail closed).`
    );
  }
  let raw;
  try {
    raw = (0, import_node_fs16.readFileSync)(abs, "utf8");
  } catch {
    throw new StructureDescriptionsError(
      `cannot read ${STRUCTURE_DESCRIPTIONS_REL} (unreadable file). Run \`arte-gitcard doctor\`.`
    );
  }
  const sha256 = sha256Content(raw);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StructureDescriptionsError(
      `${STRUCTURE_DESCRIPTIONS_REL} is not valid JSON \u2014 run \`arte-gitcard doctor\` (preserved, never auto-repaired).`
    );
  }
  const map = parseStoreDocument(parsed);
  return { status: "ok", map, sha256 };
}
function parseStoreDocument(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StructureDescriptionsError("description store must be a JSON object");
  }
  const doc = parsed;
  const allowedTop = /* @__PURE__ */ new Set(["schemaVersion", "descriptions"]);
  for (const key of Object.keys(doc)) {
    if (!allowedTop.has(key)) {
      throw new StructureDescriptionsError(`description store has an unknown top-level field "${key}"`);
    }
  }
  if (doc.schemaVersion !== STORE_SCHEMA_VERSION) {
    throw new StructureDescriptionsError(
      `description store schemaVersion is ${JSON.stringify(doc.schemaVersion)} (expected ${STORE_SCHEMA_VERSION})`
    );
  }
  const descs = doc.descriptions;
  if (!descs || typeof descs !== "object" || Array.isArray(descs)) {
    throw new StructureDescriptionsError("description store field `descriptions` must be an object");
  }
  const map = {};
  for (const key of Object.keys(descs)) {
    const keyErr = descriptionKeyError(key);
    if (keyErr) throw new StructureDescriptionsError(`invalid description key "${key}": ${keyErr}`);
    const value = descs[key];
    if (typeof value !== "string") {
      throw new StructureDescriptionsError(`description for "${key}" must be a string`);
    }
    const valueErr = descriptionValueError(value);
    if (valueErr) throw new StructureDescriptionsError(`invalid description for "${key}": ${valueErr}`);
    Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return map;
}
function serializeStructureDescriptions(map) {
  const sorted = {};
  for (const key of Object.keys(map).sort()) {
    Object.defineProperty(sorted, key, { value: map[key], enumerable: true, writable: true, configurable: true });
  }
  return JSON.stringify({ schemaVersion: STORE_SCHEMA_VERSION, descriptions: sorted }, null, 2) + "\n";
}
function loadDescriptionSnapshot(projectRoot) {
  const r = readStructureDescriptions(projectRoot);
  if (r.status === "absent") {
    return {
      present: false,
      map: {},
      contentHash: null,
      precondition: { kind: "absent", rel: STRUCTURE_DESCRIPTIONS_REL }
    };
  }
  return {
    present: true,
    map: r.map,
    contentHash: r.sha256,
    precondition: { kind: "sha256", rel: STRUCTURE_DESCRIPTIONS_REL, expectedSha256: r.sha256 }
  };
}

// src/generate/plan.ts
function toPosix2(p) {
  return p.replace(/\\/g, "/");
}
function planCardArtifactsInternal(loaded, theme, opts) {
  const runtime = opts.runtime;
  const instant = (opts.now ?? /* @__PURE__ */ new Date()).getTime();
  const { config, projectRoot } = loaded;
  const outputDir = resolveFromProject(projectRoot, config.output.directory);
  const outputDirRel = toPosix2(import_node_path18.default.relative(projectRoot, outputDir));
  const stateRead = readState(projectRoot);
  const activityDirs = stateRead.status === "ok" ? [.../* @__PURE__ */ new Set([outputDirRel, ...stateRead.state.outputRoots])].filter((d) => d !== "") : [outputDirRel];
  const registry = buildRegistryIndex(buildRegistry(config.languages));
  const session = createStatisticsSession({
    projectRoot,
    now: new Date(instant),
    outputDirRel,
    exclude: config.exclude,
    activityDirs,
    registry
  });
  const structureMap = opts.structureDescriptions ?? (() => {
    const r = readStructureDescriptions(projectRoot);
    return r.status === "ok" ? r.map : {};
  })();
  const artifacts = [];
  for (const entry of runtime.enabledDisplays(config)) {
    const displayConfig = entry.definition.id === "structure" ? {
      ...entry.config,
      descriptions: structureMap,
      repositoryName: import_node_path18.default.basename(projectRoot),
      codeIncludeComments: config.cards.codebase.languages.include_comments === true
    } : entry.config;
    const content = displayArtifactContent(entry.definition, {
      statistics: session,
      config: displayConfig,
      theme,
      now: new Date(instant)
    });
    artifacts.push({ file: entry.file, content });
  }
  if (opts.afterRender) opts.afterRender(session);
  return { artifacts };
}

// src/structure/scope.ts
var import_node_path19 = __toESM(require("path"));
var import_node_fs17 = require("fs");
function keyState(projectRoot, files, key) {
  let sawUnverifiable = false;
  let underKey = false;
  const prefix = `${key}/`;
  for (const f of files) {
    if (!f.startsWith(prefix)) continue;
    underKey = true;
    if (!resolveContained(projectRoot, f) || !pathHasNoSymlinkComponents(projectRoot, f)) {
      sawUnverifiable = true;
      continue;
    }
    const abs = resolveContained(projectRoot, f);
    let st;
    try {
      st = (0, import_node_fs17.lstatSync)(abs);
    } catch (err) {
      const code = err?.code;
      if (code === "ENOENT") continue;
      sawUnverifiable = true;
      continue;
    }
    if (st.isSymbolicLink() || !st.isFile()) {
      sawUnverifiable = true;
      continue;
    }
    return "present";
  }
  if (!underKey) return "absent";
  return sawUnverifiable ? "unverifiable" : "absent";
}
function pruneStructureKeys(projectRoot, map) {
  const files = listGitFiles(projectRoot);
  if (files === null) return { status: "unverifiable", pruned: map, removed: [] };
  const removed = [];
  const next = {};
  let anyUnverifiable = false;
  for (const key of Object.keys(map)) {
    const state = keyState(projectRoot, files, key);
    if (state === "present") {
      Object.defineProperty(next, key, { value: map[key], enumerable: true, writable: true, configurable: true });
    } else if (state === "absent") {
      removed.push(key);
    } else {
      anyUnverifiable = true;
      Object.defineProperty(next, key, { value: map[key], enumerable: true, writable: true, configurable: true });
    }
  }
  return { status: anyUnverifiable ? "unverifiable" : "ok", pruned: next, removed };
}

// src/generate/manage.ts
function toPosix3(p) {
  return p.replace(/\\/g, "/");
}
function assertWritable(projectRoot, state, rel) {
  const abs = resolveContained(projectRoot, rel);
  if (!abs) throw new CollisionError(`unsafe path: ${rel}`, rel);
  const entry = findEntry(state, rel);
  let st;
  try {
    st = (0, import_node_fs18.lstatSync)(abs);
  } catch (err) {
    const code = err?.code;
    if (code !== "ENOENT") {
      throw new CollisionError(`cannot verify write target ${rel} (fail closed, preserving).`, rel);
    }
    return { kind: "absent" };
  }
  if (entry) {
    if (st.isSymbolicLink() || st.isDirectory()) {
      throw new CollisionError(`managed path became a symlink/directory: ${rel}. Refusing to overwrite.`, rel);
    }
    if (!realpathContained(projectRoot, rel)) {
      throw new CollisionError(`managed path escaped the repository: ${rel}. Refusing to overwrite.`, rel);
    }
    return void 0;
  }
  throw new CollisionError(
    `cannot overwrite ${rel}: the file exists but arte-gitcard has no ownership record for it. Run "arte-gitcard doctor" or "arte-gitcard reset" to inspect.`,
    rel
  );
}
function planGenerateTxn(projectRoot, loaded, theme, opts = {}) {
  const stateRead = readState(projectRoot);
  if (stateRead.status !== "ok") {
    throw new StateError(
      `state.json is ${stateRead.status} \u2014 arte-gitcard cannot prove ownership. Run "arte-gitcard doctor" for diagnostics.`
    );
  }
  const state = stateRead.state;
  const runtime = opts.runtime ?? DEFAULT_RUNTIME;
  const descriptionSnapshot = loadDescriptionSnapshot(projectRoot);
  const pruneResult = pruneStructureKeys(projectRoot, descriptionSnapshot.map);
  const prunedMap = pruneResult.pruned;
  const planned = planCardArtifactsInternal(loaded, theme, {
    now: opts.now,
    runtime,
    structureDescriptions: prunedMap
  });
  const artifacts = [...planned.artifacts];
  if (opts.preview) {
    artifacts.push({
      file: PREVIEW_FILENAME,
      content: buildPreviewHtml(
        planned.artifacts.map((a) => ({ file: a.file, svg: a.content }))
      )
    });
  }
  const outputAbs = resolveFromProject(projectRoot, loaded.config.output.directory);
  const outputDirRel = toPosix3(import_node_path20.default.relative(projectRoot, outputAbs));
  const txn = emptyPlan();
  if (opts.writeConfig === true) {
    txn.writes.push({
      rel: CONFIG_FILENAME,
      abs: import_node_path20.default.join(projectRoot, CONFIG_FILENAME),
      content: import_yaml3.default.stringify(loaded.config),
      kind: "config",
      // Replaces the EXACT file that was parsed (config precondition pins it too).
      expectedBefore: loaded.sourceSha256 ? { kind: "sha256", sha256: loaded.sourceSha256 } : void 0
    });
  }
  for (const artifact of artifacts) {
    const kind = artifact.file === PREVIEW_FILENAME ? "preview" : "card";
    const rel = `${outputDirRel}/${artifact.file}`;
    const expectedBefore = assertWritable(projectRoot, state, rel);
    txn.writes.push({ rel, abs: import_node_path20.default.join(outputAbs, artifact.file), content: artifact.content, kind, expectedBefore });
    upsertEntry(state, { path: rel, kind, sha256: sha256WrittenContent(artifact.content) });
  }
  if (descriptionSnapshot.present && pruneResult.status === "ok" && pruneResult.removed.length > 0) {
    const storeAbs = import_node_path20.default.join(projectRoot, STRUCTURE_DESCRIPTIONS_REL);
    if (Object.keys(prunedMap).length === 0) {
      txn.deletes.push({
        rel: STRUCTURE_DESCRIPTIONS_REL,
        abs: storeAbs,
        kind: "structure-descriptions",
        expectedSha256: descriptionSnapshot.contentHash
      });
    } else {
      txn.writes.push({
        rel: STRUCTURE_DESCRIPTIONS_REL,
        abs: storeAbs,
        content: serializeStructureDescriptions(prunedMap),
        kind: "structure-descriptions"
      });
    }
    txn.preconditions.push(descriptionSnapshot.precondition);
  }
  if (!state.outputRoots.includes(outputDirRel)) {
    state.outputRoots = [...state.outputRoots, outputDirRel];
  }
  const sourcePre = [{ kind: "sha256", rel: STATE_REL, expectedSha256: stateRead.sha256 }];
  if (loaded.sourceSha256) {
    sourcePre.unshift({ kind: "sha256", rel: CONFIG_FILENAME, expectedSha256: loaded.sourceSha256 });
  }
  txn.preconditions = [...txn.preconditions ?? [], ...sourcePre];
  txn.stateJson = { rel: STATE_REL, content: serializeState(state) };
  return { plan: txn, state, planned, prunedDescriptions: pruneResult.removed.length };
}

// src/ci/runtime.ts
var BOT_NAME = "github-actions[bot]";
var BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
var COMMIT_MESSAGE = "chore(arte-gitcard): update cards";
var ZERO_SHA = /^0{40,64}$/;
var FULL_SHA = /^[0-9a-f]{40,64}$/;
function verifyPushEvent(env, payload, branch, head) {
  const ref = `refs/heads/${branch}`;
  if (env.eventName !== "push") return { ok: false, skip: true, reason: `event is ${String(env.eventName)}, not push` };
  if (env.ref !== ref) return { ok: false, skip: true, reason: `GITHUB_REF ${String(env.ref)} != ${ref}` };
  if (env.refName !== branch) return { ok: false, skip: true, reason: `GITHUB_REF_NAME ${String(env.refName)} != ${branch}` };
  if (payload.ref !== ref) return { ok: false, skip: true, reason: `payload.ref != ${ref}` };
  if (payload.deleted !== false) return { ok: false, skip: true, reason: "payload.deleted != false" };
  const repoDefault = payload.repository?.default_branch;
  if (repoDefault !== branch) {
    return {
      ok: false,
      skip: true,
      reason: `github.event.repository.default_branch ${String(repoDefault)} != state defaultBranch ${branch}`
    };
  }
  const after = typeof payload.after === "string" ? payload.after : "";
  if (!FULL_SHA.test(after) || ZERO_SHA.test(after)) return { ok: false, skip: true, reason: "payload.after is not a full non-zero SHA" };
  if (!env.sha || env.sha !== after) return { ok: false, skip: true, reason: "GITHUB_SHA != payload.after" };
  if (env.sha !== head) return { ok: false, skip: true, reason: "GITHUB_SHA != git HEAD (checkout not at the exact push SHA)" };
  return { ok: true };
}
var nul = (s) => s.split("\0").filter((p) => p.length > 0);
function gitArgv(args, hooksDir) {
  return ["--literal-pathspecs", "-c", `core.hooksPath=${hooksDir}`, ...args];
}
function git(root, args, hooksDir, opts = {}) {
  const argv = gitArgv(args, hooksDir);
  try {
    const out = (0, import_node_child_process3.execFileSync)("git", argv, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, ...opts.env }
    });
    return { out, code: 0 };
  } catch (err) {
    const e = err;
    if (opts.allowFail) return { out: "", code: e.status ?? 1 };
    throw new Error(`git ${args[0]} failed: ${err.message}`);
  }
}
function pushWithStaleGuard(base, hooks) {
  const pre = hooks.lsRemote();
  if (!pre.ok) {
    return {
      code: 1,
      reason: `cannot verify the remote branch before push (ls-remote failed: ${pre.error}) \u2014 failing closed, no push.`,
      pushed: false
    };
  }
  if (pre.sha === null) {
    return {
      code: 0,
      reason: "remote branch is absent (deleted) \u2014 a deleted branch is NEVER recreated; skipping stale result",
      pushed: false
    };
  }
  if (pre.sha !== base) {
    return { code: 0, reason: `remote already moved to ${pre.sha} (base ${base}) \u2014 skipping stale result`, pushed: false };
  }
  const push = hooks.runPush();
  if (push.code === 0) return { code: 0, reason: "pushed generated commit", pushed: true };
  const post = hooks.lsRemote();
  if (!post.ok) {
    return {
      code: 1,
      reason: `push rejected and the remote could not be re-verified (ls-remote failed: ${post.error}) \u2014 REAL error, no force/merge.`,
      pushed: false
    };
  }
  if (post.sha === null) {
    return {
      code: 0,
      reason: "push raced: the remote branch is now absent (deleted) \u2014 a deleted branch is NEVER recreated; skipping stale result",
      pushed: false
    };
  }
  if (post.sha !== base) {
    return {
      code: 0,
      reason: `push raced: remote moved to ${post.sha} \u2014 skipping stale result (no force/merge)`,
      pushed: false
    };
  }
  return {
    code: 1,
    reason: `push rejected while the remote is still at ${base} \u2014 this is a REAL error (branch protection / ruleset / token policy / signed-commit policy). No force push was attempted.`,
    pushed: false
  };
}
function runCi(root, env) {
  const workspace = env.workspace ? import_node_path21.default.resolve(env.workspace) : root;
  const noHooksDir = (0, import_node_fs19.mkdtempSync)(import_node_path21.default.join((0, import_node_os2.tmpdir)(), "agc-nohooks-"));
  try {
    return runCiBody(workspace, env, noHooksDir);
  } finally {
    try {
      (0, import_node_fs19.rmSync)(noHooksDir, { recursive: true, force: true });
    } catch {
    }
  }
}
function runCiBody(workspace, env, noHooksDir) {
  const log = (msg) => console.error(msg);
  const g = (args, opts) => git(workspace, args, noHooksDir, opts);
  const head = g(["rev-parse", "HEAD"], { allowFail: true }).out.trim();
  if (!head) return { code: 0, reason: "checkout has no commits \u2014 nothing to do", pushed: false };
  let event = {};
  if (env.eventPath) {
    try {
      event = JSON.parse((0, import_node_fs19.readFileSync)(env.eventPath, "utf8"));
    } catch {
      return { code: 1, reason: "cannot read GITHUB_EVENT_PATH", pushed: false };
    }
  }
  const cfgPath = import_node_path21.default.join(workspace, CONFIG_FILENAME);
  if (!(0, import_node_fs19.existsSync)(cfgPath)) return { code: 0, reason: "no arte-gitcard.yml in the checkout \u2014 nothing to do", pushed: false };
  let loaded;
  try {
    loaded = loadConfig(cfgPath);
  } catch (err) {
    return { code: 1, reason: `config is damaged (fail closed): ${err.message}`, pushed: false };
  }
  const config = loaded.config;
  if (config["auto-update"] !== true) return { code: 0, reason: "auto-update is disabled \u2014 nothing to do", pushed: false };
  log("arte-gitcard-ci: config validated");
  const stateRead = readState(workspace);
  if (stateRead.status !== "ok") {
    return { code: 1, reason: `state.json is ${stateRead.status} \u2014 failing closed, no changes made.`, pushed: false };
  }
  let state = stateRead.state;
  const branch = state.github?.defaultBranch ?? "";
  if (!branch) {
    return {
      code: 1,
      reason: "auto-update is enabled but state.json has no default-branch snapshot \u2014 run `arte-gitcard github sync`. No changes were made.",
      pushed: false
    };
  }
  const refOk = g(["check-ref-format", `refs/heads/${branch}`], { allowFail: true });
  if (refOk.code !== 0) {
    return {
      code: 1,
      reason: `state.json defaultBranch "${branch}" is not a valid git ref (fail closed) \u2014 run \`arte-gitcard github sync\`. No changes were made.`,
      pushed: false
    };
  }
  const verdict = verifyPushEvent({ ...env, workspace }, event, branch, head);
  if (!verdict.ok) return { code: 0, reason: verdict.reason ?? "event not for us", pushed: false };
  log(`arte-gitcard-ci: event accepted: default branch "${branch}" @ ${head.slice(0, 7)}`);
  if ((0, import_node_fs19.existsSync)(import_node_path21.default.join(workspace, JOURNAL_REL))) {
    return {
      code: 1,
      reason: "an orphaned transaction journal exists (.arte-git-card/txn.json). arte-gitcard will NOT auto-recover in CI \u2014 run `arte-gitcard doctor` locally. No changes were made.",
      pushed: false
    };
  }
  const preStaged = new Set(nul(g(["diff", "--cached", "--name-only", "-z", "--no-renames"], { allowFail: true }).out));
  let theme;
  try {
    theme = resolveTheme(loadTheme(config.theme, workspace));
  } catch (err) {
    return { code: 1, reason: `selected theme is not resolvable (fail closed): ${err.message}`, pushed: false };
  }
  const { plan, state: plannedState, planned, prunedDescriptions } = planGenerateTxn(workspace, loaded, theme);
  state = plannedState;
  const outputAbs = resolveFromProject(workspace, config.output.directory);
  const outputRel = import_node_path21.default.relative(workspace, outputAbs).replace(/\\/g, "/");
  const desired = new Set(planned.artifacts.map((a) => `${outputRel}/${a.file}`));
  for (const entry of [...state.managedFiles]) {
    if (entry.kind !== "card") continue;
    if (desired.has(entry.path)) continue;
    const status = assertDeletable(workspace, entry);
    if (status === "ok") {
      plan.deletes.push({ rel: entry.path, abs: resolveFromProject(workspace, entry.path), kind: "card", expectedSha256: entry.sha256 });
    } else if (status === "modified" || status === "unsafe") {
      log(`warn: ${entry.path} (${status}) \u2014 preserved, not removed`);
    }
    removeEntry(state, entry.path);
  }
  plan.stateJson = { rel: STATE_REL, content: serializeState(state) };
  runTransaction(plan, { repoRoot: workspace, command: "ci-generate", guard: buildManagedGuard(workspace, config) });
  log(`arte-gitcard-ci: generated ${planned.artifacts.length} card artifact(s)`);
  if (prunedDescriptions > 0) {
    log(`arte-gitcard-ci: structure descriptions: ${prunedDescriptions} stale pruned`);
  }
  const allowlist = /* @__PURE__ */ new Set();
  for (const e of plan.writes) allowlist.add(e.rel);
  for (const d of plan.deletes) allowlist.add(d.rel);
  if (plan.stateJson) allowlist.add(plan.stateJson.rel);
  if (allowlist.size === 0) return { code: 0, reason: "no owned changes produced", pushed: false };
  for (const rel of allowlist) g(["add", "--", rel]);
  const stagedNow = nul(g(["diff", "--cached", "--name-only", "-z", "--no-renames"], { allowFail: true }).out);
  const ourStaged = stagedNow.filter((p) => allowlist.has(p));
  const unlistedStaged = stagedNow.filter((p) => !allowlist.has(p));
  if (!unlistedStaged.every((p) => preStaged.has(p))) {
    return {
      code: 1,
      reason: `index contains staged files outside the allowlist that were not pre-staged: ${unlistedStaged.join(", ")}`,
      pushed: false
    };
  }
  if (ourStaged.length === 0) return { code: 0, reason: "no changes to arte-gitcard-owned files", pushed: false };
  log(`arte-gitcard-ci: changed ${ourStaged.length} managed path(s)`);
  g(["config", "user.name", BOT_NAME]);
  g(["config", "user.email", BOT_EMAIL]);
  const commitCall = g(["commit", "-m", COMMIT_MESSAGE, "--", ...allowlist], { allowFail: true });
  if (commitCall.code !== 0) {
    return { code: 1, reason: `commit failed: ${commitCall.out.trim()}`, pushed: false };
  }
  log(`arte-gitcard-ci: committed ${ourStaged.length} managed path(s)`);
  const commitSha = g(["rev-parse", "HEAD"], { allowFail: true }).out.trim();
  const actualCommitted = nul(g(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--no-renames", commitSha], { allowFail: true }).out);
  const foreign = actualCommitted.filter((p) => !allowlist.has(p));
  if (foreign.length > 0) {
    return {
      code: 1,
      reason: `commit contained non-allowlist paths ${foreign.join(", ")} \u2014 failing closed, NOT pushing.`,
      pushed: false
    };
  }
  const lsRemote = () => {
    const call = g(["ls-remote", "origin", `refs/heads/${branch}`], { allowFail: true });
    if (call.code !== 0) return { ok: false, error: `ls-remote exited ${call.code}` };
    const sha = call.out.split(/\s+/)[0] ?? "";
    return { ok: true, sha: sha === "" ? null : sha };
  };
  const runPush = () => g(["push", "origin", `HEAD:refs/heads/${branch}`], { allowFail: true });
  const push = pushWithStaleGuard(head, { runPush, lsRemote });
  return { code: push.code, reason: push.reason, pushed: push.pushed };
}
function ciMain() {
  const root = import_node_path21.default.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
  const env = {
    eventName: process.env.GITHUB_EVENT_NAME,
    eventPath: process.env.GITHUB_EVENT_PATH,
    ref: process.env.GITHUB_REF,
    refName: process.env.GITHUB_REF_NAME,
    sha: process.env.GITHUB_SHA,
    workspace: root
  };
  try {
    const result = runCi(root, env);
    if (result.reason) console.error(`arte-gitcard-ci: ${result.reason}`);
    process.exitCode = result.code;
  } catch (err) {
    console.error(`arte-gitcard-ci: ${err.message}`);
    process.exitCode = 1;
  }
}

// src/ci/main.ts
ciMain();
