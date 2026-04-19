export const PARSELTONGUE_TECHNIQUES = [
  { id: 'none', name: 'Raw (None)' },
  { id: 'b64', name: 'Base64 Encoded' },
  { id: 'rot13', name: 'ROT13 Cipher' },
  { id: 'token_split', name: 'Token Splitting (v1.2)' },
  { id: 'semantic_shift', name: 'Semantic Shifting' },
  { id: 'unspaced', name: 'Zero-Space Overflow' },
  { id: 'l33t', name: 'L33t Speak' },
  { id: 'zgo', name: 'Zalgo Corruption' },
  { id: 'rev', name: 'Inverse Byte Order' }
];

export function perturbate(text: string, technique: string): string {
  switch (technique) {
    case 'b64':
      return btoa(text);
    case 'rot13':
      return text.replace(/[a-zA-Z]/g, (c: string) => {
        const charCode = c.charCodeAt(0);
        return String.fromCharCode(
          (charCode <= 90 ? 90 : 122) >= (charCode + 13) ? charCode + 13 : charCode - 13
        );
      });
    case 'token_split':
      return text.split('').join('·');
    case 'unspaced':
      return text.replace(/\s/g, '⟠');
    case 'semantic_shift':
      // Semantic shift usually requires an LLM pass, but we can do a rule-based shift for common terms or just garble it slightly
      return text
        .replace(/\b(how)\b/gi, 'In what manner')
        .replace(/\b(create)\b/gi, 'Synthesize')
        .replace(/\b(make)\b/gi, 'Fabricate')
        .replace(/\b(danger)\b/gi, 'Critical Entropy')
        .replace(/\b(hack)\b/gi, 'Systemic Bypass');
    case 'l33t':
      return text.replace(/e/gi, '3').replace(/a/gi, '4').replace(/o/gi, '0').replace(/t/gi, '7').replace(/s/gi, '5');
    case 'rev':
      return text.split('').reverse().join('');
    case 'zgo':
      return text.split('').map(c => c + '\u030d\u030e\u0304\u0305\u033f\u0311\u0306\u0310\u0352\u0357\u0351\u0307\u0308\u030a\u0342\u0343\u0344\u034a\u034b\u034c\u0350\u0300\u0301\u0302\u0303\u0358\u0346\u0315'[Math.floor(Math.random() * 28)]).join('');
    default:
      return text;
  }
}
