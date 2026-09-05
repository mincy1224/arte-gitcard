/**
 * Directory tree (plan.md §65). Built from the scanned file paths — only
 * directories that contain files appear. `root` is a synthetic "." whose
 * children render at depth 0; `max_depth` truncates below it.
 */

import type { ScannedFile } from "../scanner/files.js";

export interface DirectoryNode {
  name: string;
  /** POSIX path relative to the DISPLAY root ("." for the synthetic root). */
  rel: string;
  /** POSIX path relative to the REPOSITORY root (for activity lookup). */
  repoRel: string;
  depth: number;
  /** Number of descendant directories (recursive, excluding self). */
  descendantDirs: number;
  /** Direct child directories (pre-prune). */
  directDirs: number;
  /** Direct child files (files whose immediate parent is this node). */
  directFiles: number;
  children: DirectoryNode[];
  parent?: DirectoryNode;
}

function dirPathOf(fileRel: string): string[] {
  const parts = fileRel.split("/");
  parts.pop();
  return parts;
}

/**
 * Build the directory tree from scanned file paths. Deterministic (children
 * sorted). `root` is the display root label (e.g. "packages/foo" after the
 * prefix was stripped from the file paths). `descendantDirs` counts REAL
 * subtree directories (count before max_depth prune — SPEC §5).
 */
export function buildTree(
  files: ScannedFile[],
  root: string,
  maxDepth: number,
): DirectoryNode {
  const rootRel = root === "." ? "." : root;
  const synthetic: DirectoryNode = {
    name: root === "." ? "." : root,
    rel: ".",
    repoRel: rootRel,
    depth: -1,
    descendantDirs: 0,
    directDirs: 0,
    directFiles: 0,
    children: [],
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
    // node is the file's immediate parent (the synthetic root for display-root files).
    node.directFiles += 1;
  }

  // Sort (code-unit, deterministic) and count the FULL tree first, so pruning never shrinks the counts.
  const sortAndCount = (node: DirectoryNode): number => {
    node.children.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    node.directDirs = node.children.length;
    let count = 0;
    for (const child of node.children) count += 1 + sortAndCount(child);
    node.descendantDirs = count;
    return count;
  };
  sortAndCount(synthetic);

  // Truncate at max_depth: prune everything deeper than maxDepth (counts kept).
  const prune = (node: DirectoryNode, depth: number): void => {
    if (depth >= maxDepth) {
      node.children = [];
      return;
    }
    for (const child of node.children) prune(child, depth + 1);
  };
  prune(synthetic, 0);

  return synthetic;
}

/** Flatten the tree DFS (deterministic), including the synthetic root's children at depth 0. */
export function flattenTree(root: DirectoryNode): DirectoryNode[] {
  const out: DirectoryNode[] = [];
  const walk = (node: DirectoryNode): void => {
    if (node.depth >= 0) out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}
