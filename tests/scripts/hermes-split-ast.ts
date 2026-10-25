export interface ExtractedBlock {
  readonly block: string;
  readonly start: number;
  readonly end: number;
}

export function extractFunctionBlock(content: string, name: string): ExtractedBlock | undefined {
  const pattern = new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|type|interface)\\s+${name}\\b`);
  const match = pattern.exec(content);
  if (!match) return undefined;

  const start = match.index;
  const isTypeAlias = /^(?:export\s+)?type\s+/.test(content.slice(start, start + 30).trim());
  if (isTypeAlias) {
    let depth = 0;
    for (let i = start; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{' || ch === '(' || ch === '[' || ch === '<') depth++;
      else if (ch === '}' || ch === ')' || ch === ']' || ch === '>') depth--;
      else if (ch === ';' && depth === 0) {
        let end = i + 1;
        if (content[end] === '\n') end++;
        return { block: content.slice(start, end).trim(), start, end };
      }
    }
    return undefined;
  }

  const isFunction = content.slice(start, start + 50).includes('function');
  let bodyBrace = -1;

  if (isFunction) {
    const paramStart = content.indexOf('(', start);
    if (paramStart === -1) return undefined;
    let pDepth = 0;
    let paramEnd = -1;
    for (let i = paramStart; i < content.length; i++) {
      if (content[i] === '(') pDepth++;
      else if (content[i] === ')') {
        pDepth--;
        if (pDepth === 0) {
          paramEnd = i;
          break;
        }
      }
    }
    if (paramEnd === -1) return undefined;

    let typeDepth = 0;
    for (let i = paramEnd + 1; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') {
        if (typeDepth === 0) {
          const trimmed = content.slice(paramEnd + 1, i).trim();
          const isTypeLiteral = /[:<&|,]\s*$/.test(trimmed) || trimmed.endsWith('=>') || trimmed.endsWith('readonly');
          if (isTypeLiteral) {
            typeDepth++;
            continue;
          }
          bodyBrace = i;
          break;
        } else {
          typeDepth++;
        }
      } else if (ch === '}') {
        typeDepth--;
      }
    }
  } else {
    bodyBrace = content.indexOf('{', start);
  }

  if (bodyBrace === -1) return undefined;

  let depth = 0;
  let inString = false;
  let quote = '';
  let escape = false;
  for (let i = bodyBrace; i < content.length; i++) {
    const ch = content[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (inString) {
      if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        if (content[end] === ';') end++;
        if (content[end] === '\n') end++;
        return { block: content.slice(start, end).trim(), start, end };
      }
    }
  }
  return undefined;
}

export function reconcileTargetImports(
  sourceImports: readonly string[],
  code: string,
  relSourcePath?: string,
  sourceExports: readonly string[] = [],
): string[] {
  const needed: string[] = [];
  for (const imp of sourceImports) {
    const names = imp.match(/\{([^}]+)\}/);
    if (names && names[1]) {
      const symbols = names[1].split(',').map((s) => s.trim().replace(/^type\s+/, ''));
      const used = symbols.filter((s) => new RegExp(`\\b${s}\\b`).test(code));
      if (used.length > 0) {
        const fromPath = imp.match(/from\s+['"]([^'"]+)['"]/)?.[1];
        if (fromPath) needed.push(`import { ${used.join(', ')} } from '${fromPath}';`);
      }
    }
  }
  if (relSourcePath && sourceExports.length > 0) {
    const fromSource = sourceExports.filter((s) => new RegExp(`\\b${s}\\b`).test(code));
    if (fromSource.length > 0) {
      needed.push(`import { ${fromSource.join(', ')} } from '${relSourcePath}';`);
    }
  }
  return needed;
}

export function performFileSplit(
  sourceContent: string,
  targetRelPath: string,
  functionNames: readonly string[],
  relSourcePath?: string,
): { updatedSource: string; targetContent: string; extractedCount: number } {
  const importMatches = sourceContent.matchAll(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];/g);
  const sourceImports: string[] = [];
  for (const m of importMatches) sourceImports.push(m[0].replace(/\s+/g, ' '));

  const extractedBlocks: string[] = [];
  let currentSource = sourceContent;
  const sortedNames = [...functionNames];

  for (const name of sortedNames) {
    const blockData = extractFunctionBlock(currentSource, name);
    if (blockData) {
      extractedBlocks.push(blockData.block);
      currentSource = currentSource.slice(0, blockData.start) + currentSource.slice(blockData.end);
    }
  }

  let foundInternal = true;
  while (foundInternal) {
    foundInternal = false;
    const internalCandidateMatches = Array.from(currentSource.matchAll(/(?:^|\n)\s*(?:(?:async\s+)?function|type|interface)\s+([a-zA-Z0-9_$]+)/g));
    for (const match of internalCandidateMatches) {
      const candidateName = match[1];
      if (!candidateName || functionNames.includes(candidateName)) continue;
      const refInExtracted = extractedBlocks.some((b) => new RegExp(`\\b${candidateName}\\b`).test(b));
      if (refInExtracted) {
        const blockData = extractFunctionBlock(currentSource, candidateName);
        if (blockData) {
          const withoutBlock = currentSource.slice(0, blockData.start) + currentSource.slice(blockData.end);
          if (!new RegExp(`\\b${candidateName}\\b`).test(withoutBlock)) {
            extractedBlocks.unshift(blockData.block);
            currentSource = withoutBlock;
            foundInternal = true;
            break;
          }
        }
      }
    }
  }

  const exportMatches = currentSource.matchAll(/export\s+(?:interface|type|function|const)\s+([a-zA-Z0-9_$]+)/g);
  const sourceExports = Array.from(exportMatches).map((m) => m[1] ?? '').filter((s) => s.length > 0 && !functionNames.includes(s));

  const combinedExtracted = extractedBlocks.join('\n\n');
  const targetImports = reconcileTargetImports(sourceImports, combinedExtracted, relSourcePath, sourceExports);
  const targetContent = `${targetImports.join('\n')}\n\n${combinedExtracted}\n`;

  const remainingCodeWithoutImports = currentSource.replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?\n?/g, '');
  const updatedSourceImports = reconcileTargetImports(sourceImports, remainingCodeWithoutImports);

  const relImport = targetRelPath.startsWith('.') ? targetRelPath : './' + targetRelPath;
  const nameIsType = new Map<string, boolean>();
  for (const b of extractedBlocks) {
    const m = b.trim().match(/^(?:export\s+)?(type|interface)\s+([a-zA-Z0-9_$]+)/);
    if (m && m[2]) {
      nameIsType.set(m[2], true);
    }
  }
  const barrelMembers = functionNames.map((n) => (nameIsType.get(n) ? `type ${n}` : n));
  const normalizedTargetImport = relImport.replace(/\.(ts|tsx)$/, '.js');
  const barrelExport = `\nexport { ${barrelMembers.join(', ')} } from '${normalizedTargetImport}';\n`;
  const usedInSource = functionNames.filter((n) => new RegExp(`\\b${n}\\b`).test(remainingCodeWithoutImports));
  if (usedInSource.length > 0) {
    const usedMembers = usedInSource.map((n) => (nameIsType.get(n) ? `type ${n}` : n));
    updatedSourceImports.push(`import { ${usedMembers.join(', ')} } from '${normalizedTargetImport}';`);
  }
  const updatedSource = `${updatedSourceImports.join('\n')}\n\n${remainingCodeWithoutImports.trim()}\n${barrelExport}`;

  return { updatedSource, targetContent, extractedCount: extractedBlocks.length };
}
