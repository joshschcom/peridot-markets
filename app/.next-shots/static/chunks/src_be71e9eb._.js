(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/vaults/registry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Single typed list of every way a market can earn yield, plus who can select it today.
 * Pure data and helpers, no network access, safe in node unit tests and server rendering. */ __turbopack_context__.s([
    "COMING_SOON_COPY",
    ()=>COMING_SOON_COPY,
    "STATUS_LABEL",
    ()=>STATUS_LABEL,
    "STATUS_TONE",
    ()=>STATUS_TONE,
    "VAULT_OPTIONS",
    ()=>VAULT_OPTIONS,
    "getVaultOption",
    ()=>getVaultOption,
    "groupByStatus",
    ()=>groupByStatus,
    "isSubmittable",
    ()=>isSubmittable,
    "statusLabel",
    ()=>statusLabel,
    "statusOn",
    ()=>statusOn,
    "unavailableOptions",
    ()=>unavailableOptions
]);
const STATUS_LABEL = {
    'live-mainnet': 'Live on mainnet',
    testnet: 'Testnet',
    demo: 'Demo flow',
    'coming-soon': 'Coming soon'
};
const STATUS_TONE = {
    'live-mainnet': 'success',
    testnet: 'info',
    demo: 'warn',
    'coming-soon': 'neutral'
};
const COMING_SOON_COPY = 'Coming soon, not active in this demo.';
const VAULT_OPTIONS = [
    {
        id: 'idle',
        name: 'Keep in Peridot',
        tagline: 'No external venue',
        detail: 'Funds stay in the market. Suppliers earn only borrower interest.',
        status: 'live-mainnet',
        factoryRoute: 'None',
        risk: 'Lowest'
    },
    {
        id: 'blend',
        name: 'Blend fee vault',
        tagline: 'Boosted lending yield',
        detail: 'Idle liquidity is lent in a Blend pool through an allowlisted fee vault. Blend pool risk applies.',
        status: 'live-mainnet',
        factoryRoute: 'Blend',
        risk: 'Low',
        href: 'https://blend.capital'
    },
    {
        id: 'defindex',
        name: 'DeFindex vault',
        tagline: 'Managed strategy vault',
        detail: 'Idle liquidity goes to an allowlisted DeFindex vault that runs Blend autocompound strategies.',
        status: 'live-mainnet',
        factoryRoute: 'Defindex',
        risk: 'Low',
        href: 'https://defindex.io'
    },
    {
        id: 'aquarius',
        name: 'Aquarius LP vault',
        tagline: 'Concentrated liquidity plus AQUA rewards',
        detail: 'Idle liquidity becomes a concentrated Aquarius position that earns swap fees and AQUA. Impermanent loss is possible. The factory cannot deploy this route yet: the creation flow here is a demo.',
        status: 'demo',
        factoryRoute: null,
        risk: 'Medium',
        href: '/vaults'
    },
    {
        id: 'xoxno',
        name: 'XOXNO Lending',
        tagline: 'Hub and spoke lending',
        detail: 'Idle liquidity would be supplied to XOXNO Lending through an adapter that is not deployed yet.',
        status: 'coming-soon',
        factoryRoute: null,
        risk: 'Medium',
        href: 'https://github.com/XOXNO/rs-lending-xlm'
    },
    {
        id: 'zenex',
        name: 'Zenex perps vault',
        tagline: 'Earn perpetual futures fees',
        detail: 'Idle liquidity would back Zenex traders and earn their fees. Vault shares can lose value and withdrawals wait at least one hour. The adapter is not deployed yet.',
        status: 'coming-soon',
        factoryRoute: null,
        risk: 'Higher',
        href: 'https://docs.zenex.trade'
    }
];
function getVaultOption(id) {
    const found = VAULT_OPTIONS.find((o)=>o.id === id);
    if (!found) throw new Error("Unknown vault option ".concat(id, "."));
    return found;
}
function isSubmittable(option) {
    return option.factoryRoute !== null && (option.status === 'live-mainnet' || option.status === 'testnet');
}
function statusOn(option, net) {
    if (option.status === 'live-mainnet' && net === 'testnet') return 'testnet';
    return option.status;
}
function statusLabel(option, net) {
    const s = statusOn(option, net);
    return s === 'coming-soon' ? 'Coming soon' : STATUS_LABEL[s];
}
function unavailableOptions() {
    return VAULT_OPTIONS.filter((o)=>!isSubmittable(o));
}
function groupByStatus() {
    const out = {
        'live-mainnet': [],
        testnet: [],
        demo: [],
        'coming-soon': []
    };
    for (const o of VAULT_OPTIONS)out[o.status].push(o);
    return out;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/vaults/VaultOptionList.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "VaultOptionList",
    ()=>VaultOptionList,
    "VaultStatusBadge",
    ()=>VaultStatusBadge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUpRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-up-right.js [app-client] (ecmascript) <export default as ArrowUpRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.js [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/primitives.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/registry.ts [app-client] (ecmascript)");
'use client';
;
;
;
;
;
;
;
function VaultStatusBadge(param) {
    let { option } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
        tone: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STATUS_TONE"][(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["statusOn"])(option, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name)],
        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["statusLabel"])(option, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name)
    }, void 0, false, {
        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
_c = VaultStatusBadge;
function VaultOptionList(param) {
    let { selected, onSelect, disabled, compact, ariaLabel = 'Yield venues' } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "vault-options".concat(compact ? ' compact' : ''),
        role: "group",
        "aria-label": ariaLabel,
        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VAULT_OPTIONS"].map((option)=>{
            const live = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSubmittable"])(option);
            const isSelected = selected === option.id;
            const body = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "vault-option-top",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "vault-option-name",
                                children: [
                                    isSelected && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                        size: 14,
                                        "aria-hidden": true
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                                        lineNumber: 32,
                                        columnNumber: 62
                                    }, this),
                                    !live && !isSelected && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                        size: 13,
                                        "aria-hidden": true
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                                        lineNumber: 32,
                                        columnNumber: 119
                                    }, this),
                                    option.name
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                                lineNumber: 32,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VaultStatusBadge, {
                                option: option
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                                lineNumber: 33,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                        lineNumber: 31,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "vault-option-tag",
                        children: option.tagline
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                        lineNumber: 35,
                        columnNumber: 9
                    }, this),
                    !compact && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "vault-option-detail",
                        children: option.detail
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                        lineNumber: 36,
                        columnNumber: 22
                    }, this),
                    option.status === 'coming-soon' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "vault-option-note",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COMING_SOON_COPY"]
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                        lineNumber: 37,
                        columnNumber: 45
                    }, this),
                    option.status === 'demo' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "vault-option-note",
                        children: "Demo flow only. Nothing is deployed on chain from this app yet."
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                        lineNumber: 38,
                        columnNumber: 38
                    }, this)
                ]
            }, void 0, true);
            if (live && onSelect) {
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    className: "vault-option selectable".concat(isSelected ? ' selected' : ''),
                    "aria-pressed": isSelected,
                    disabled: disabled,
                    onClick: ()=>onSelect(option),
                    children: body
                }, option.id, false, {
                    fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                    lineNumber: 41,
                    columnNumber: 16
                }, this);
            }
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "vault-option".concat(live ? '' : ' locked'),
                "aria-disabled": !live,
                "data-vault": option.id,
                children: [
                    body,
                    option.id === 'aquarius' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        className: "text-link vault-option-link",
                        href: "/vaults",
                        children: [
                            "Try the Aquarius vault demo ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUpRight$3e$__["ArrowUpRight"], {
                                size: 13,
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                                lineNumber: 45,
                                columnNumber: 127
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                        lineNumber: 45,
                        columnNumber: 38
                    }, this)
                ]
            }, option.id, true, {
                fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
                lineNumber: 43,
                columnNumber: 14
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/src/components/vaults/VaultOptionList.tsx",
        lineNumber: 26,
        columnNumber: 10
    }, this);
}
_c1 = VaultOptionList;
var _c, _c1;
__turbopack_context__.k.register(_c, "VaultStatusBadge");
__turbopack_context__.k.register(_c1, "VaultOptionList");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/margin-registry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decodeMarginRegistry",
    ()=>decodeMarginRegistry,
    "isMarginPoolUsable",
    ()=>isMarginPoolUsable,
    "loadMarginRegistry",
    ()=>loadMarginRegistry,
    "poolEligibility",
    ()=>poolEligibility
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
;
;
;
// Read the deployed factory's public storage until its registry getters are exposed.
// Reject schema changes rather than guessing whether a pool is eligible.
const fieldKey = (name, pool)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvSymbol(name),
        ...pool ? [
            new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](pool).toScVal()
        ] : []
    ]);
const ledgerKey = (contract, key)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].LedgerKey.contractData(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].LedgerKeyContractData({
        contract: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](contract).toScAddress(),
        key,
        durability: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ContractDataDurability.persistent
    }));
function decodeMarginRegistry(raw, factory, marketFactory) {
    if (raw.type !== 'scvContractInstance' || !raw.instance.storage) throw new Error('Margin registry instance is unavailable.');
    const value = (name)=>{
        var _raw_instance_storage_find;
        return (_raw_instance_storage_find = raw.instance.storage.find((e)=>e.key.toXDR('base64') === fieldKey(name).toXDR('base64'))) === null || _raw_instance_storage_find === void 0 ? void 0 : _raw_instance_storage_find.val;
    };
    const router = value('Router'), enforced = value('RegistryEnforced'), market = value('MarketFactory');
    if ((router === null || router === void 0 ? void 0 : router.type) !== 'scvAddress' || !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromScVal(router).toString()) || (enforced === null || enforced === void 0 ? void 0 : enforced.type) !== 'scvBool' || (market === null || market === void 0 ? void 0 : market.type) !== 'scvAddress' || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromScVal(market).toString() !== marketFactory) throw new Error('Margin registry configuration is invalid or belongs to another market factory.');
    return {
        router: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromScVal(router).toString(),
        enforced: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(enforced),
        factory
    };
}
async function loadMarginRegistry() {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["assertRpcNetwork"])();
    const d = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])();
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(d.margin_factory || '')) throw new Error('Margin factory is not configured.');
    const key = ledgerKey(d.margin_factory, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvLedgerKeyContractInstance());
    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRpc"])().getLedgerEntries(key), entry = response.entries.find((e)=>e.key.toXDR('base64') === key.toXDR('base64'));
    if ((entry === null || entry === void 0 ? void 0 : entry.val.type) !== 'contractData') throw new Error('Margin registry instance is unavailable.');
    const registry = decodeMarginRegistry(entry.val.contractData.val, d.margin_factory, d.factory);
    const configured = d.external.aquarius_router;
    if (configured && configured !== registry.router) throw new Error('Configured Aquarius router differs from the margin factory.');
    return registry;
}
function poolEligibility(enforced, trusted, denied) {
    for (const flag of [
        trusted,
        denied
    ])if (flag && flag.type !== 'scvBool') throw new Error('Margin pool registry flag has an invalid schema.');
    return !Boolean(denied && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(denied)) && (!enforced || Boolean(trusted && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(trusted)));
}
async function isMarginPoolUsable(registry, pool) {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(pool)) return false;
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["assertRpcNetwork"])();
    const keys = [
        'TrustedPool',
        'DeniedPool'
    ].map((name)=>ledgerKey(registry.factory, fieldKey(name, pool)));
    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRpc"])().getLedgerEntries(...keys);
    const values = keys.map((key)=>{
        const entry = response.entries.find((e)=>e.key.toXDR('base64') === key.toXDR('base64'));
        if (!entry) return undefined;
        if (entry.val.type !== 'contractData') throw new Error('Margin pool registry data is malformed.');
        return entry.val.contractData.val;
    });
    return poolEligibility(registry.enforced, values[0], values[1]);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/mock.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MOCK_CUSTOM_TOKENS",
    ()=>MOCK_CUSTOM_TOKENS,
    "MOCK_DEMO_TOKEN",
    ()=>MOCK_DEMO_TOKEN,
    "MOCK_EURC",
    ()=>MOCK_EURC,
    "MOCK_NOFEED_TOKEN",
    ()=>MOCK_NOFEED_TOKEN,
    "MOCK_ORACLE",
    ()=>MOCK_ORACLE,
    "MOCK_OWNER",
    ()=>MOCK_OWNER,
    "MOCK_USDC",
    ()=>MOCK_USDC,
    "MOCK_XLM",
    ()=>MOCK_XLM,
    "mockActivateMarket",
    ()=>mockActivateMarket,
    "mockCreateMarket",
    ()=>mockCreateMarket,
    "mutateMockState",
    ()=>mutateMockState,
    "readMockState",
    ()=>readMockState,
    "writeMockEvent",
    ()=>writeMockEvent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
;
const MOCK_OWNER = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const MOCK_USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const MOCK_EURC = 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV';
const MOCK_XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
const MOCK_DEMO_TOKEN = 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR';
const MOCK_NOFEED_TOKEN = 'CAEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQSCIJBEEQTD2L';
const MOCK_CUSTOM_TOKENS = {
    [MOCK_DEMO_TOKEN]: {
        symbol: 'PDEMO',
        decimals: 7,
        name: 'Peridot Demo Token',
        totalSupply: 10_000_000_000_000n
    },
    [MOCK_NOFEED_TOKEN]: {
        symbol: 'NOFEED',
        decimals: 7,
        name: 'Unpriced Demo Token',
        totalSupply: 2_500_000_000_000n
    }
};
const MOCK_ORACLE = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN';
const key = "peridot:mock:v1:".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name);
function initial() {
    const config = (token, symbol)=>({
            token,
            collateral_factor: 700000n,
            supply_cap: 1000000000000n,
            borrow_cap: 500000000000n,
            reserve_factor: 100000n,
            rates: symbol === 'XLM' ? {
                base: 0n,
                multiplier: 0n,
                jump: 0n,
                kink: 0n
            } : {
                base: 0n,
                multiplier: 80000n,
                jump: 2000000n,
                kink: 900000n
            },
            idle_buffer_bps: 2000,
            yield_route: {
                tag: 'None',
                values: undefined
            },
            price: {
                tag: 'ReflectorOnly',
                values: [
                    {
                        oracle: MOCK_ORACLE,
                        asset: {
                            tag: 'Other',
                            values: [
                                symbol
                            ]
                        }
                    }
                ]
            },
            margin_enabled: true,
            supply_reward_per_sec: 0n,
            borrow_reward_per_sec: 0n
        });
    return {
        groups: [
            {
                id: 1,
                owner: MOCK_OWNER,
                name: 'Meridian',
                controller: 'mock-controller-1',
                price_router: 'mock-router-1',
                reward_distributor: undefined,
                margin_controller: 'mock-margin-1',
                markets: [
                    'mock-market-1-USDC',
                    'mock-market-1-XLM'
                ],
                created_at: BigInt(Math.floor(Date.now() / 1000)),
                keeper_mode: {
                    tag: 'None',
                    values: undefined
                },
                keeper_paid_until: 0n
            }
        ],
        configs: {
            '1:mock-market-1-USDC': config(MOCK_USDC, 'USDC'),
            '1:mock-market-1-XLM': config(MOCK_XLM, 'XLM')
        },
        tokens: {
            [MOCK_USDC]: {
                symbol: 'USDC',
                decimals: 7
            },
            [MOCK_XLM]: {
                symbol: 'XLM',
                decimals: 7
            },
            [MOCK_EURC]: {
                symbol: 'EURC',
                decimals: 7
            },
            [MOCK_DEMO_TOKEN]: {
                symbol: 'PDEMO',
                decimals: 7
            },
            [MOCK_NOFEED_TOKEN]: {
                symbol: 'NOFEED',
                decimals: 7
            }
        },
        history: {},
        pending: {},
        nextId: 2
    };
}
const replacer = (_key, value)=>typeof value === 'bigint' ? {
        __peridotBigint: value.toString()
    } : value;
const reviver = (_key, value)=>value && typeof value === 'object' && '__peridotBigint' in value ? BigInt(value.__peridotBigint) : value;
let memory;
function readMockState() {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) throw new Error('Mock data is disabled.');
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        const value = window.localStorage.getItem(key);
        if (value) {
            const parsed = JSON.parse(value, reviver);
            parsed.tokens[MOCK_EURC] = {
                symbol: 'EURC',
                decimals: 7
            };
            parsed.tokens[MOCK_DEMO_TOKEN] = {
                symbol: 'PDEMO',
                decimals: 7
            };
            parsed.tokens[MOCK_NOFEED_TOKEN] = {
                symbol: 'NOFEED',
                decimals: 7
            };
            return parsed;
        }
    } catch (e) {}
    return memory !== null && memory !== void 0 ? memory : memory = initial();
}
function mutateMockState(fn) {
    const state = readMockState();
    const result = fn(state);
    memory = state;
    try {
        window.localStorage.setItem(key, JSON.stringify(state, replacer));
    } catch (e) {}
    return result;
}
function writeMockEvent(state, groupId, method, detail) {
    var _state_history, _String;
    const hash = "mock-".concat(Date.now(), "-").concat(Math.random().toString(16).slice(2));
    var _;
    ((_ = (_state_history = state.history)[_String = String(groupId)]) !== null && _ !== void 0 ? _ : _state_history[_String] = []).unshift({
        timestamp: Math.floor(Date.now() / 1000),
        method,
        hash,
        detail
    });
    return hash;
}
function mockCreateMarket(state, id, market, cfg, metadata) {
    const group = state.groups.find((g)=>g.id === id);
    if (!group) throw new Error('Group not found.');
    if (group.reward_distributor) throw new Error('Markets cannot be added after group rewards are enabled.');
    const existing = Object.entries(state.configs).filter((param)=>{
        let [key] = param;
        return key.startsWith("".concat(id, ":"));
    });
    if (existing.length >= 16) throw new Error('A group supports at most 16 markets.');
    if (existing.some((param)=>{
        let [, value] = param;
        return value.token === cfg.token;
    })) throw new Error('This token already has a market in the group.');
    if (cfg.supply_reward_per_sec !== 0n || cfg.borrow_reward_per_sec !== 0n) throw new Error('Creation reward speeds must be zero.');
    state.configs["".concat(id, ":").concat(market)] = cfg;
    state.tokens[cfg.token] = metadata;
    state.pending["market-record:".concat(id, ":").concat(market)] = {
        active: false
    };
}
function mockActivateMarket(state, id, market) {
    const group = state.groups.find((g)=>g.id === id);
    if (!group) throw new Error('Group not found.');
    if (group.reward_distributor) throw new Error('Markets cannot be activated after group rewards are enabled.');
    if (!state.configs["".concat(id, ":").concat(market)]) throw new Error('Market not found.');
    if (group.markets.includes(market)) throw new Error('Market is already active.');
    group.markets.push(market);
    state.pending["market-record:".concat(id, ":").concat(market)] = {
        active: true
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/factory.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canonicalTokenSymbol",
    ()=>canonicalTokenSymbol,
    "encodeMarketConfig",
    ()=>encodeMarketConfig,
    "encodePrice",
    ()=>encodePrice,
    "encodeRates",
    ()=>encodeRates,
    "findReflectorFeed",
    ()=>findReflectorFeed,
    "getGroup",
    ()=>getGroup,
    "getMarketConfig",
    ()=>getMarketConfig,
    "getTokenMetadata",
    ()=>getTokenMetadata,
    "isOracleAllowed",
    ()=>isOracleAllowed,
    "isPriceFeedAllowed",
    ()=>isPriceFeedAllowed,
    "isYieldVaultAllowed",
    ()=>isYieldVaultAllowed,
    "listGroups",
    ()=>listGroups,
    "normalizeContract",
    ()=>normalizeContract,
    "readTokenMetadata",
    ()=>readTokenMetadata,
    "scAddress",
    ()=>scAddress,
    "scBool",
    ()=>scBool,
    "scEnum",
    ()=>scEnum,
    "scI128",
    ()=>scI128,
    "scMap",
    ()=>scMap,
    "scSymbol",
    ()=>scSymbol,
    "scU128",
    ()=>scU128,
    "scU32",
    ()=>scU32,
    "validateYieldRoute",
    ()=>validateYieldRoute,
    "validateYieldVenue",
    ()=>validateYieldVenue,
    "writeFactory",
    ()=>writeFactory
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$asset$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/asset.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/mock.ts [app-client] (ecmascript)");
;
;
;
;
const scAddress = (value)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](value).toScVal();
const scU32 = (value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(value, {
        type: 'u32'
    });
const scU128 = (value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(value, {
        type: 'u128'
    });
const scI128 = (value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(value, {
        type: 'i128'
    });
const scBool = (value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(value, {
        type: 'bool'
    });
const scSymbol = (value)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(value, {
        type: 'symbol'
    });
const scMap = (values)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvMap(Object.entries(values).sort((param, param1)=>{
        let [a] = param, [b] = param1;
        return a < b ? -1 : a > b ? 1 : 0;
    }).map((param)=>{
        let [key, val] = param;
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScMapEntry({
            key: scSymbol(key),
            val
        });
    }));
const scEnum = (tag, value)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec(value ? [
        scSymbol(tag),
        value
    ] : [
        scSymbol(tag)
    ]);
function encodeRates(r) {
    return scMap({
        base: scU128(r.base),
        multiplier: scU128(r.multiplier),
        jump: scU128(r.jump),
        kink: scU128(r.kink)
    });
}
function encodePrice(p) {
    if (p.tag !== 'ReflectorOnly') throw new Error('This build supports Reflector pricing only.');
    const cfg = p.values[0];
    return scEnum(p.tag, scMap({
        oracle: scAddress(cfg.oracle),
        asset: scEnum(cfg.asset.tag, cfg.asset.tag === 'Other' ? scSymbol(cfg.asset.values[0]) : scAddress(cfg.asset.values[0]))
    }));
}
function encodeMarketConfig(c) {
    let route;
    if (c.yield_route.tag === 'None') route = scEnum('None');
    else if (c.yield_route.tag === 'Defindex') route = scEnum('Defindex', scMap({
        vault: scAddress(c.yield_route.values[0].vault)
    }));
    else if (c.yield_route.tag === 'Blend') route = scEnum('Blend', scMap({
        fee_vault: scAddress(c.yield_route.values[0].fee_vault)
    }));
    else throw new Error('Yield route is not available in phase 1.');
    return scMap({
        token: scAddress(c.token),
        collateral_factor: scU128(c.collateral_factor),
        supply_cap: scU128(c.supply_cap),
        borrow_cap: scU128(c.borrow_cap),
        reserve_factor: scU128(c.reserve_factor),
        rates: encodeRates(c.rates),
        idle_buffer_bps: scU32(c.idle_buffer_bps),
        yield_route: route,
        price: encodePrice(c.price),
        margin_enabled: scBool(c.margin_enabled),
        supply_reward_per_sec: scU128(c.supply_reward_per_sec),
        borrow_reward_per_sec: scU128(c.borrow_reward_per_sec)
    });
}
function normalizeContract(value) {
    if (Array.isArray(value)) {
        const tags = [
            'None',
            'Defindex',
            'Blend',
            'Aquarius',
            'Zenex',
            'Xoxno',
            'ReflectorOnly',
            'ReflectorWithAquariusGuard',
            'AquariusOnly',
            'Stellar',
            'Other',
            'Audited',
            'Custom',
            'PeridotHosted',
            'SelfHosted'
        ];
        if (typeof value[0] === 'string' && tags.includes(value[0])) return {
            tag: value[0],
            values: value.length > 1 ? value.slice(1).map((v)=>normalizeContract(v)) : undefined
        };
        return value.map((v)=>normalizeContract(v));
    }
    if (value && typeof value === 'object' && !(value instanceof Uint8Array)) return Object.fromEntries(Object.entries(value).map((param)=>{
        let [k, v] = param;
        return [
            k,
            normalizeContract(v)
        ];
    }));
    return value;
}
async function getGroup(id) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const g = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readMockState"])().groups.find((g)=>g.id === id);
        if (!g) throw new Error('Group not found.');
        return g;
    }
    return normalizeContract(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory, 'get_group', [
        scU32(id)
    ]));
}
async function listGroups() {
    let start = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0, limit = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 100;
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readMockState"])().groups.filter((g)=>g.id >= start).slice(0, limit);
    return normalizeContract(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory, 'list_groups', [
        scU32(start),
        scU32(limit)
    ]));
}
async function getMarketConfig(id, market) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const cfg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readMockState"])().configs["".concat(id, ":").concat(market)];
        if (!cfg) throw new Error('Market not found.');
        return cfg;
    }
    return normalizeContract(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory, 'get_market_config', [
        scU32(id),
        scAddress(market)
    ]));
}
function canonicalTokenSymbol(token, symbol) {
    return token === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$asset$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Asset"].native().contractId(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase) ? 'XLM' : symbol;
}
async function getTokenMetadata(token) {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(token)) throw new Error('Enter a valid Stellar token contract address.');
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readMockState"])().tokens[token];
        if (!t) throw new Error('Demo mode supports the example XLM, USDC and EURC tokens.');
        return t;
    }
    return readTokenMetadata(token, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"]);
}
async function readTokenMetadata(token, read) {
    const [symbol, decimals] = await Promise.all([
        read(token, 'symbol'),
        read(token, 'decimals')
    ]);
    if (typeof symbol !== 'string' || !symbol) throw new Error('Token symbol is unavailable.');
    if (typeof decimals !== 'number' || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimals.');
    return {
        symbol: canonicalTokenSymbol(token, symbol),
        decimals
    };
}
async function writeFactory(method, args, signer, onProgress) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitContract"])({
        contractId: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory,
        method,
        args,
        signer,
        onProgress
    });
}
async function findReflectorFeed(token, symbol) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const { MOCK_ORACLE } = await __turbopack_context__.A("[project]/src/lib/peridot/mock.ts [app-client] (ecmascript, async loader)");
        const price = {
            tag: 'ReflectorOnly',
            values: [
                {
                    oracle: MOCK_ORACLE,
                    asset: {
                        tag: 'Other',
                        values: [
                            symbol
                        ]
                    }
                }
            ]
        };
        if (!await isPriceFeedAllowed(token, price)) throw new Error('This token and price feed mapping is not approved by the factory.');
        return price;
    }
    const d = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])();
    for (const [key, tag, asset] of [
        [
            'reflector_stellar',
            'Stellar',
            token
        ],
        [
            'reflector_external',
            'Other',
            symbol
        ]
    ]){
        const oracle = d.external[key];
        if (typeof oracle !== 'string' || !oracle) continue;
        // A self-reported symbol is only a candidate; the central tuple allowlist proves the mapping.
        if (!await isOracleAllowed(oracle)) continue;
        const assets = normalizeContract(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(oracle, 'assets'));
        if (assets.some((a)=>a.tag === tag && a.values[0] === asset)) {
            const price = {
                tag: 'ReflectorOnly',
                values: [
                    {
                        oracle,
                        asset: {
                            tag,
                            values: [
                                asset
                            ]
                        }
                    }
                ]
            };
            if (await isPriceFeedAllowed(token, price)) return price;
        }
    }
    throw new Error('This token is not covered by the configured Reflector feeds.');
}
async function isOracleAllowed(oracle) {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(oracle)) return false;
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const { MOCK_ORACLE } = await __turbopack_context__.A("[project]/src/lib/peridot/mock.ts [app-client] (ecmascript, async loader)");
        return oracle === MOCK_ORACLE;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory, 'is_oracle_allowed', [
        scAddress(oracle)
    ]);
}
async function isYieldVaultAllowed(vault) {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(vault)) return false;
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? true : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory, 'is_yield_vault_allowed', [
        scAddress(vault)
    ]);
}
async function isPriceFeedAllowed(token, price) {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(token) || price.tag !== 'ReflectorOnly') return false;
    const { oracle, asset } = price.values[0];
    if (!await isOracleAllowed(oracle)) return false;
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const { MOCK_USDC, MOCK_XLM, MOCK_EURC, MOCK_DEMO_TOKEN } = await __turbopack_context__.A("[project]/src/lib/peridot/mock.ts [app-client] (ecmascript, async loader)");
        const symbols = {
            [MOCK_USDC]: 'USDC',
            [MOCK_XLM]: 'XLM',
            [MOCK_EURC]: 'EURC',
            [MOCK_DEMO_TOKEN]: 'PDEMO'
        };
        if (!symbols[token]) return false;
        return asset.tag === 'Stellar' ? asset.values[0] === token : asset.tag === 'Other' && asset.values[0] === symbols[token];
    }
    const encodedAsset = scEnum(asset.tag, asset.tag === 'Stellar' ? scAddress(asset.values[0]) : scSymbol(asset.values[0]));
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().factory, 'is_price_feed_allowed', [
        scAddress(token),
        scAddress(oracle),
        encodedAsset
    ]);
}
function yieldStruct(raw, fields) {
    var _result_name;
    if (raw.type !== 'scvMap' || !raw.map) throw new Error('Yield venue returned a malformed contract record.');
    const result = {};
    for (const entry of raw.map){
        if (entry.key.type !== 'scvSymbol') throw new Error('Yield venue returned a malformed contract record.');
        const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(entry.key);
        if (name in result) throw new Error('Yield venue returned a duplicated contract field.');
        result[name] = entry.val;
    }
    for (const [name, type] of Object.entries(fields))if (((_result_name = result[name]) === null || _result_name === void 0 ? void 0 : _result_name.type) !== type) throw new Error("Yield venue returned an invalid ".concat(name, " field."));
    return result;
}
async function validateYieldVenue(token, route, read) {
    if (route.tag === 'None') return;
    if (route.tag === 'Defindex') {
        const vault = route.values[0].vault;
        const [assets, amounts] = await Promise.all([
            read(vault, 'get_assets'),
            read(vault, 'get_asset_amounts_per_shares', [
                scI128(0n)
            ])
        ]);
        if (assets.type !== 'scvVec' || !assets.vec || assets.vec.length !== 1) throw new Error('DeFindex must manage exactly one underlying asset.');
        const asset = yieldStruct(assets.vec[0], {
            address: 'scvAddress',
            strategies: 'scvVec'
        });
        if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromScVal(asset.address).toString() !== token) throw new Error('The DeFindex underlying asset does not match this market token.');
        const strategies = asset.strategies;
        if (strategies.type !== 'scvVec' || !strategies.vec) throw new Error('DeFindex strategy information is unavailable.');
        let active = false;
        for (const strategy of strategies.vec){
            const fields = yieldStruct(strategy, {
                address: 'scvAddress',
                name: 'scvString',
                paused: 'scvBool'
            });
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(fields.paused) === false) active = true;
        }
        if (!active) throw new Error('DeFindex needs at least one unpaused strategy.');
        if (amounts.type !== 'scvVec' || !amounts.vec || amounts.vec.length !== 1 || amounts.vec[0].type !== 'scvI128') throw new Error('DeFindex share conversion must return exactly one signed token amount.');
        return;
    }
    if (route.tag === 'Blend') {
        const vault = route.values[0].fee_vault;
        const [pool, reserve] = await Promise.all([
            read(vault, 'get_pool'),
            read(vault, 'get_reserve_vault', [
                scAddress(token)
            ])
        ]);
        if (pool.type !== 'scvAddress' || !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromScVal(pool).toString())) throw new Error('The Blend fee vault does not reference a valid pool contract.');
        yieldStruct(reserve, {
            accrued_fees: 'scvI128',
            address: 'scvAddress',
            b_rate: 'scvI128',
            last_update_timestamp: 'scvU64',
            total_b_tokens: 'scvI128',
            total_shares: 'scvI128'
        });
        return;
    }
    throw new Error('Yield route is not available in this phase.');
}
async function validateYieldRoute(token, route) {
    if (route.tag === 'None') return;
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(token)) throw new Error('Enter a valid market token before configuring yield.');
    const vault = route.tag === 'Defindex' ? route.values[0].vault : route.tag === 'Blend' ? route.values[0].fee_vault : '';
    if (!vault || !await isYieldVaultAllowed(vault)) throw new Error('The yield vault is not approved by this factory.');
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return; // Demo venues do not claim a live partner configuration.
    await validateYieldVenue(token, route, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContractRaw"]);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/group-client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Group lending uses the audited core ABI. Flow design informed by PeridotV2Full
 * 86ae3795/lib/stellar-soroban-lending.ts; addresses and transport are group scoped. */ __turbopack_context__.s([
    "addr",
    ()=>addr,
    "claimRewards",
    ()=>claimRewards,
    "enumName",
    ()=>enumName,
    "isMissingTrustlineError",
    ()=>isMissingTrustlineError,
    "lend",
    ()=>lend,
    "mockAccount",
    ()=>mockAccount,
    "rateApr",
    ()=>rateApr,
    "readMarket",
    ()=>readMarket,
    "readMarketSummary",
    ()=>readMarketSummary,
    "readRewards",
    ()=>readRewards,
    "readWalletTokenBalance",
    ()=>readWalletTokenBalance,
    "tokenInfo",
    ()=>tokenInfo,
    "uint",
    ()=>uint,
    "unitEnum",
    ()=>unitEnum
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$amount$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/amount.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/factory.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/mock.ts [app-client] (ecmascript)");
;
;
;
;
;
;
const addr = (value)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](value).toScVal();
const uint = function(value) {
    let type = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 'u128';
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(value, {
        type
    });
};
const unitEnum = (value)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvSymbol(value)
    ]);
const enumName = (value)=>typeof value === 'string' ? value : Array.isArray(value) ? String(value[0]) : value && typeof value === 'object' && 'tag' in value ? String(value.tag) : '';
const MOCK_KEY = 'peridot:group-portfolio:v1';
function mockBook() {
    try {
        return JSON.parse(localStorage.getItem(MOCK_KEY) || '{}');
    } catch (e) {
        return {};
    }
}
function mockKey(group, market, owner) {
    return "".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, ":").concat(group.id, ":").concat(market, ":").concat(owner);
}
function saveBook(book) {
    try {
        localStorage.setItem(MOCK_KEY, JSON.stringify(book));
    } catch (e) {
        throw new Error('Demo storage is unavailable. Enable browser storage to retain this action.');
    }
}
function mockAccount(group, market, owner) {
    return mockBook()[mockKey(group, market, owner)] || {
        supplied: '0',
        debt: '0',
        entered: false
    };
}
async function tokenInfo(token) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return {
        address: token,
        ...await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getTokenMetadata"])(token)
    };
    const [symbol, decimals] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(token, 'symbol', []),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(token, 'decimals', [])
    ]);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token precision.');
    return {
        address: token,
        symbol: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["canonicalTokenSymbol"])(token, symbol),
        decimals
    };
}
function rateApr(config, cash, borrowed) {
    let reserves = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 0n;
    const total = cash + borrowed - reserves;
    if (cash < 0n || borrowed < 0n || reserves < 0n || total < 0n) throw new Error('Invalid market totals.');
    const rawUtil = total > 0n ? borrowed * 1_000_000n / total : 0n;
    const util = rawUtil > 1_000_000n ? 1_000_000n : rawUtil;
    const r = config.rates;
    const borrow = r.base + (util <= r.kink ? util * r.multiplier / 1_000_000n : r.kink * r.multiplier / 1_000_000n + (util - r.kink) * r.jump / 1_000_000n);
    const supply = borrow * (1_000_000n - config.reserve_factor) / 1_000_000n * util / 1_000_000n;
    return {
        borrowApr: Number(borrow) / 10000,
        supplyApr: Number(supply) / 10000,
        utilization: Number(util) / 10000
    };
}
function isMissingTrustlineError(error, token, owner) {
    if (!(error instanceof Error)) return false;
    const message = error.message;
    return message.includes('Error(Contract, #13)') && message.includes("contract:".concat(token, ",")) && new RegExp('"trustline entry is missing for account"\\s*,\\s*'.concat(owner, "\\s*\\]")).test(message);
}
async function readWalletTokenBalance(token, owner) {
    let read = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"];
    try {
        const balance = await read(token, 'balance', [
            addr(owner)
        ]);
        if (typeof balance !== 'bigint' || balance < 0n) throw new Error('Token returned an invalid wallet balance.');
        return {
            balance,
            needsTrustline: false
        };
    } catch (error) {
        if (isMissingTrustlineError(error, token, owner)) return {
            balance: 0n,
            needsTrustline: true
        };
        throw error;
    }
}
async function readMarket(group, market, config, owner) {
    const tokenRequest = tokenInfo(config.token);
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const token = await tokenRequest;
        const account = mockAccount(group, market, owner || '');
        const supplied = 100_000n * 10n ** BigInt(token.decimals) + BigInt(account.supplied), borrowed = 20_000n * 10n ** BigInt(token.decimals) + BigInt(account.debt);
        return {
            address: market,
            config,
            token,
            supplied,
            borrowed,
            liquidity: supplied - borrowed,
            receiptBalance: BigInt(account.supplied),
            walletBalance: 10_000n * 10n ** BigInt(token.decimals) - BigInt(account.supplied) + BigInt(account.debt),
            needsTrustline: false,
            debt: BigInt(account.debt),
            exchangeRate: 1_000_000n,
            ...rateApr(config, supplied - borrowed, borrowed),
            price: {
                mode: 'ReflectorOnly',
                reflector_price: 100_000_000n,
                aquarius_price: undefined,
                deviation_bps: undefined,
                status: 'ok',
                timestamp: BigInt(Math.floor(Date.now() / 1000))
            },
            vault: null,
            entered: account.entered
        };
    }
    const details = (async ()=>{
        let price = null, priceError, vault = null, vaultError;
        try {
            price = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.price_router, 'check', [
                addr(config.token)
            ]);
        } catch (e) {
            priceError = String(e);
        }
        if (config.yield_route.tag !== 'None') {
            try {
                const vaultId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_boosted_vault', []);
                if (vaultId && config.yield_route.tag !== 'Defindex') vault = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(vaultId, 'get_state', []);
                else if (vaultId) {
                    const shares = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(vaultId, 'balance', [
                        addr(market)
                    ]);
                    const amounts = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(vaultId, 'get_asset_amounts_per_shares', [
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(shares, {
                            type: 'i128'
                        })
                    ]);
                    vault = {
                        kind: 'DeFindex',
                        underlying: config.token,
                        total_shares: shares,
                        total_value: amounts[0] || 0n,
                        principal: 0n,
                        reserve: 0n,
                        last_harvest_ts: 0n,
                        last_harvest_amount: 0n,
                        apy_hint_bps: 0,
                        paused: false
                    };
                }
            } catch (e) {
                vaultError = String(e);
            }
        }
        return {
            price,
            priceError,
            vault,
            vaultError
        };
    })();
    const [supplied, borrowed, liquidity, exchangeRate, reserves, receiptBalance, walletState, debt, enteredMarkets, token, { price, priceError, vault, vaultError }] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_total_underlying', []),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_total_borrowed', []),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_available_liquidity', []),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_exchange_rate', []),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_total_reserves', []),
        owner ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_ptoken_balance', [
            addr(owner)
        ]) : 0n,
        owner ? readWalletTokenBalance(config.token, owner) : {
            balance: 0n,
            needsTrustline: false
        },
        owner ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_user_borrow_balance', [
            addr(owner)
        ]) : 0n,
        owner ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.controller, 'get_user_markets', [
            addr(owner)
        ]) : [],
        tokenRequest,
        details
    ]);
    // Config rate curve is an APR quote, not a historical compounded yield.
    return {
        address: market,
        config,
        token,
        supplied,
        borrowed,
        liquidity,
        exchangeRate,
        receiptBalance,
        walletBalance: walletState.balance,
        needsTrustline: walletState.needsTrustline,
        debt,
        ...rateApr(config, supplied + reserves - borrowed, borrowed, reserves),
        price,
        priceError,
        vault,
        vaultError,
        entered: enteredMarkets.includes(market)
    };
}
async function readMarketSummary(group, market, config) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return readMarket(group, market, config, null);
    const [token, supplied, borrowed] = await Promise.all([
        tokenInfo(config.token),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_total_underlying'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market, 'get_total_borrowed')
    ]);
    if (supplied < 0n || borrowed < 0n) throw new Error('Invalid market totals.');
    const utilization = supplied > 0n ? Math.min(100, Number(borrowed * 10000n / supplied) / 100) : 0;
    return {
        address: market,
        config,
        token,
        supplied,
        borrowed,
        utilization
    };
}
async function lend(group, market, action, amount, signer, onProgress) {
    let all = arguments.length > 6 && arguments[6] !== void 0 ? arguments[6] : false;
    if (market.needsTrustline && action !== 'Enable collateral') throw new Error("Add a ".concat(market.token.symbol, " trustline with your wallet before receiving or using this asset, then refresh balances."));
    const units = action === 'Enable collateral' || all && (action === 'Withdraw' || action === 'Repay') ? 0n : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$amount$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["parseAmount"])(amount, market.token.decimals);
    if (action !== 'Enable collateral' && units <= 0n && !all) throw new Error('Enter an amount greater than zero.');
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'simulating',
            message: "Demo ".concat(action.toLowerCase())
        });
        const book = mockBook(), key = mockKey(group, market.address, signer.address), old = mockAccount(group, market.address, signer.address);
        let supplied = BigInt(old.supplied), debt = BigInt(old.debt);
        if (action === 'Supply') {
            if (group.reward_distributor && !old.entered) throw new Error('Enable this market before supplying to earn rewards.');
            if (units > market.walletBalance) throw new Error('Amount exceeds your wallet balance.');
            supplied += units;
        }
        if (action === 'Withdraw') {
            if (!all && units > supplied) throw new Error('Amount exceeds your supplied balance.');
            supplied = all ? 0n : supplied - units;
        }
        if (action === 'Borrow') {
            if (!old.entered) throw new Error('Enable this market before borrowing its asset.');
            if (units > market.liquidity) throw new Error('The market has insufficient liquidity.');
            debt += units;
        }
        if (action === 'Repay') debt = all ? 0n : debt - (units > debt ? debt : units);
        book[key] = {
            supplied: supplied.toString(),
            debt: debt.toString(),
            entered: old.entered || action === 'Enable collateral'
        };
        if (action === 'Borrow' || action === 'Withdraw') {
            const state = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readMockState"])();
            let collateral = 0n, totalDebt = 0n;
            for (const address of group.markets){
                const account = book[mockKey(group, address, signer.address)] || {
                    supplied: '0',
                    debt: '0',
                    entered: false
                };
                const cfg = state.configs["".concat(group.id, ":").concat(address)];
                if (account.entered && cfg) collateral += BigInt(account.supplied) * cfg.collateral_factor / 1_000_000n;
                totalDebt += BigInt(account.debt);
            }
            if (totalDebt > collateral) throw new Error('Enable enough collateral in this group before borrowing or withdrawing.');
        }
        saveBook(book);
        if (group.reward_distributor && book[key].entered) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mutateMockState"])((state)=>{
            var _state_pending, _key, _control;
            const key = "control:".concat(group.id);
            var _;
            const control = (_ = (_state_pending = state.pending)[_key = key]) !== null && _ !== void 0 ? _ : _state_pending[_key] = {
                changes: [],
                pauses: {}
            };
            const supplyReward = market.supplied > 0n ? market.config.supply_reward_per_sec * supplied / market.supplied : 0n;
            const borrowReward = market.borrowed > 0n ? market.config.borrow_reward_per_sec * debt / market.borrowed : 0n;
            var _rewardAccrued;
            const accrued = (_rewardAccrued = (_control = control).rewardAccrued) !== null && _rewardAccrued !== void 0 ? _rewardAccrued : _control.rewardAccrued = {};
            var _accrued_signer_address;
            accrued[signer.address] = ((_accrued_signer_address = accrued[signer.address]) !== null && _accrued_signer_address !== void 0 ? _accrued_signer_address : 0n) + supplyReward + borrowReward;
        });
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'success',
            message: 'Demo action saved. No onchain transaction.'
        });
        return {
            hash: '',
            value: undefined
        };
    }
    let contractId = market.address, method = action.toLowerCase(), args = [
        addr(signer.address),
        uint(units)
    ];
    if (action === 'Supply' && group.reward_distributor) {
        const entered = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.controller, 'get_user_markets', [
            addr(signer.address)
        ]);
        if (!entered.includes(market.address)) throw new Error('Enable this market before supplying to earn rewards.');
    }
    if (action === 'Supply') {
        method = 'deposit';
        if (units > market.walletBalance) throw new Error('Amount exceeds your wallet balance.');
    }
    if (action === 'Enable collateral') {
        contractId = group.controller;
        method = 'enter_market';
        args = [
            addr(signer.address),
            addr(market.address)
        ];
    }
    if (action === 'Withdraw') {
        const [rate, balance, max] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market.address, 'get_exchange_rate'),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(market.address, 'get_ptoken_balance', [
                addr(signer.address)
            ]),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.controller, 'preview_redeem_max', [
                addr(signer.address),
                addr(market.address)
            ])
        ]);
        if (rate <= 0n) throw new Error('Invalid current exchange rate.');
        const shares = all ? balance : units * 1_000_000n / rate;
        if (shares <= 0n || shares > max || shares > balance) throw new Error('Withdrawal exceeds your available collateral or market liquidity.');
        args = [
            addr(signer.address),
            uint(shares)
        ];
    }
    if (action === 'Borrow') {
        const entered = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.controller, 'get_user_markets', [
            addr(signer.address)
        ]);
        if (!entered.includes(market.address)) throw new Error('Enable this market before borrowing its asset.');
        const max = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.controller, 'preview_borrow_max', [
            addr(signer.address),
            addr(market.address)
        ]);
        if (units > max) throw new Error('Borrow amount exceeds your available borrow power or liquidity.');
    }
    if (action === 'Repay' && !all && units > market.walletBalance) throw new Error('Repayment exceeds your wallet balance.');
    if (action === 'Repay' && all) {
        method = 'repay_max';
        args = [
            addr(signer.address)
        ];
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitContract"])({
        contractId,
        method,
        args,
        signer,
        onProgress
    });
}
async function readRewards(group, owner) {
    if (!group.reward_distributor) return null;
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        var _control_rewardAccrued;
        const state = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readMockState"])();
        const token = state.pending["reward-token:".concat(group.id)];
        if (!token) throw new Error('Demo reward token metadata is missing. Reconfigure this demo group.');
        const control = state.pending["control:".concat(group.id)];
        var _control_rewardAccrued_owner, _control_rewardBalance;
        return {
            token,
            accrued: owner ? (_control_rewardAccrued_owner = control === null || control === void 0 ? void 0 : (_control_rewardAccrued = control.rewardAccrued) === null || _control_rewardAccrued === void 0 ? void 0 : _control_rewardAccrued[owner]) !== null && _control_rewardAccrued_owner !== void 0 ? _control_rewardAccrued_owner : 0n : 0n,
            available: (_control_rewardBalance = control === null || control === void 0 ? void 0 : control.rewardBalance) !== null && _control_rewardBalance !== void 0 ? _control_rewardBalance : 0n
        };
    }
    const token = await tokenInfo(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.reward_distributor, 'reward_token', []));
    const [accrued, available] = await Promise.all([
        owner ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.controller, 'get_accrued', [
            addr(owner)
        ]) : 0n,
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.reward_distributor, 'balance_available', [])
    ]);
    return {
        token,
        accrued,
        available
    };
}
async function claimRewards(group, signer, onProgress) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        if (!group.reward_distributor) throw new Error('This group has no reward token.');
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mutateMockState"])((state)=>{
            var _control_rewardAccrued;
            var _state_pending, _key, _control;
            const key = "control:".concat(group.id);
            var _;
            const control = (_ = (_state_pending = state.pending)[_key = key]) !== null && _ !== void 0 ? _ : _state_pending[_key] = {
                changes: [],
                pauses: {}
            };
            var _control_rewardAccrued_signer_address, _control_rewardBalance;
            const accrued = (_control_rewardAccrued_signer_address = (_control_rewardAccrued = control.rewardAccrued) === null || _control_rewardAccrued === void 0 ? void 0 : _control_rewardAccrued[signer.address]) !== null && _control_rewardAccrued_signer_address !== void 0 ? _control_rewardAccrued_signer_address : 0n, available = (_control_rewardBalance = control.rewardBalance) !== null && _control_rewardBalance !== void 0 ? _control_rewardBalance : 0n;
            const paid = accrued < available ? accrued : available;
            control.rewardBalance = available - paid;
            var _rewardAccrued;
            ((_rewardAccrued = (_control = control).rewardAccrued) !== null && _rewardAccrued !== void 0 ? _rewardAccrued : _control.rewardAccrued = {})[signer.address] = accrued - paid;
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$mock$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeMockEvent"])(state, group.id, 'claim', "Demo claim paid ".concat(paid, " base units; unpaid accrual remains."));
        });
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'success',
            message: 'Demo claim saved. No real tokens moved.'
        });
        return {
            hash: '',
            value: undefined
        };
    }
    const rewardToken = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(group.reward_distributor, 'reward_token');
    const recipient = await readWalletTokenBalance(rewardToken, signer.address);
    if (recipient.needsTrustline) throw new Error('Add the reward token trustline with your wallet before claiming. Refresh after confirmation.');
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitContract"])({
        contractId: group.controller,
        method: 'claim',
        args: [
            addr(signer.address)
        ],
        signer,
        onProgress
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/margin.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConfirmedStageError",
    ()=>ConfirmedStageError,
    "accruedCloseTarget",
    ()=>accruedCloseTarget,
    "bufferedDebt",
    ()=>bufferedDebt,
    "cancelClose",
    ()=>cancelClose,
    "cancelOpen",
    ()=>cancelOpen,
    "closeAccrualApr",
    ()=>closeAccrualApr,
    "closeHasSwapped",
    ()=>closeHasSwapped,
    "closePosition",
    ()=>closePosition,
    "closeQuoteTarget",
    ()=>closeQuoteTarget,
    "decodeDebtAccrualState",
    ()=>decodeDebtAccrualState,
    "decodeMarginPoolRegistry",
    ()=>decodeMarginPoolRegistry,
    "effectiveLeverage",
    ()=>effectiveLeverage,
    "findRoute",
    ()=>findRoute,
    "liquidationPriceEstimate",
    ()=>liquidationPriceEstimate,
    "marginContext",
    ()=>marginContext,
    "minOutput",
    ()=>minOutput,
    "openExecutionFloor",
    ()=>openExecutionFloor,
    "openPosition",
    ()=>openPosition,
    "openTradeAmount",
    ()=>openTradeAmount,
    "positions",
    ()=>positions,
    "quoteOpen",
    ()=>quoteOpen,
    "repayResidual",
    ()=>repayResidual,
    "resumeOpen",
    ()=>resumeOpen,
    "solveShortInput",
    ()=>solveShortInput,
    "withdrawMargin",
    ()=>withdrawMargin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$margin$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/margin-registry.ts [app-client] (ecmascript)");
/** Staged V3 flow and recovery adapted from PeridotV2Full@86ae3795:
 * lib/stellar-margin.ts, use-stellar-margin-open.ts, use-stellar-margin-close.ts,
 * and marginMath.ts. All addresses/config are resolved per group. */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/group-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/factory.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
const SCALE = 1_000_000n;
const MOCK_POSITIONS = 'peridot:margin-demo:v1';
function revive(_key, value) {
    return typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value;
}
function mockPositions(ctx, owner) {
    try {
        return JSON.parse(localStorage.getItem("".concat(MOCK_POSITIONS, ":").concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, ":").concat(ctx.group.id, ":").concat(ctx.info.controller, ":").concat(owner)) || '[]', revive);
    } catch (e) {
        return [];
    }
}
function saveMock(ctx, owner, positions) {
    localStorage.setItem("".concat(MOCK_POSITIONS, ":").concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, ":").concat(ctx.group.id, ":").concat(ctx.info.controller, ":").concat(owner), JSON.stringify(positions, (_key, value)=>typeof value === 'bigint' ? "".concat(value, "n") : value));
}
const effectiveLeverage = (groupMax, cf)=>{
    if (!Number.isFinite(groupMax) || groupMax < 1 || cf < 0n || cf >= 1_000_000n) throw new Error('Invalid leverage limits.');
    return Math.min(groupMax, 1 / (1 - Number(cf) / 1e6));
};
function openTradeAmount(underlying, leverage, side, marginPrice, basePrice) {
    if (underlying <= 0n || !Number.isInteger(leverage) || leverage < 2 || marginPrice.some((v)=>v <= 0n) || basePrice.some((v)=>v <= 0n)) throw new Error('Invalid open valuation.');
    const value = underlying * marginPrice[0] / marginPrice[1], notional = value * BigInt(leverage);
    if (side === 'Long') return underlying + (notional - value) * marginPrice[1] / marginPrice[0];
    return notional * basePrice[1] / basePrice[0];
}
function liquidationPriceEstimate(side, collateral, debt, maintenance) {
    if (collateral <= 0n || debt <= 0n || maintenance <= 0n || maintenance >= SCALE) return null;
    const ratio = Number(maintenance) / Number(SCALE);
    // Long maintenance is based on collateral value; short maintenance on debt value.
    return side === 'Long' ? Number(debt) / (Number(collateral) * (1 - ratio)) : Number(collateral) / (Number(debt) * (1 + ratio));
}
function closeHasSwapped(pending) {
    return pending.received_debt_asset > 0n || pending.debt_amount > 0n;
}
function minOutput(quote, slippageBps) {
    if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 1000) throw new Error('Slippage must be between 0 and 10%.');
    return quote * BigInt(10000 - slippageBps) / 10000n;
}
function bufferedDebt(debt) {
    return (debt * 10010n + 9999n) / 10000n;
}
async function solveShortInput(collateral, target, quote) {
    if (collateral <= 0n || target <= 0n) throw new Error('Invalid close amount.');
    if (await quote(collateral) < target) throw new Error('Position collateral cannot cover the current debt and interest buffer.');
    let lo = 1n, hi = collateral;
    // Integer bisection verifies the result against actual pool quotes.
    for(let i = 0; lo < hi && i < 128; i++){
        const mid = (lo + hi) / 2n;
        if (await quote(mid) >= target) hi = mid;
        else lo = mid + 1n;
    }
    if (await quote(hi) < target) throw new Error('Pool quote changed. Review the close again.');
    return hi;
}
async function marginContext(group, markets) {
    if (!group.margin_controller) return null;
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return {
        group,
        markets,
        info: {
            controller: group.margin_controller,
            swap_adapter: 'mock-swap',
            variant: {
                tag: 'Audited',
                values: undefined
            },
            cfg: {
                variant: {
                    tag: 'Audited',
                    values: undefined
                },
                max_leverage: 3n,
                max_slippage: 10000n,
                liquidation_incentive: 1080000n,
                liquidation_fee: 0n
            },
            enabled_markets: markets.filter((m)=>m.config.margin_enabled).map((m)=>m.address)
        }
    };
    const info = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeContract"])(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().margin_factory, 'get_margin_status', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(group.id, 'u32')
    ]));
    if (!info || info.controller !== group.margin_controller) throw new Error('Margin configuration does not match this group.');
    const limits = Object.fromEntries(await Promise.all(markets.map(async (market)=>[
            market.address,
            Number(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().margin_factory, 'effective_max_leverage', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(group.id, 'u32'),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(market.address)
            ]))
        ])));
    return {
        group,
        info,
        markets,
        limits,
        status: info
    };
}
const read = function(ctx, method) {
    let args = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(ctx.info.controller, method, args);
};
async function write(ctx, method, args, signer, onProgress) {
    onProgress === null || onProgress === void 0 ? void 0 : onProgress({
        status: 'simulating',
        message: method.replaceAll('_', ' ')
    });
    const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitContract"])({
        contractId: ctx.info.controller,
        method,
        args,
        signer,
        onProgress
    });
    // A later stage must simulate against state that includes the confirmed write.
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["waitForLedgerBeyond"])(result.ledger);
    } catch (e) {
        throw new ConfirmedStageError(method, result);
    }
    return result;
}
class ConfirmedStageError extends Error {
    constructor(method, receipt){
        const id = method === 'begin_open_position_v3' && typeof receipt.value === 'bigint' ? " Position #".concat(receipt.value, ".") : '';
        const recovery = method === 'transfer_spot_to_margin' ? ' Your funds are free margin; return them to supply below or review the open again.' : ' Refresh positions and resume the confirmed stage.';
        super("".concat(method.replaceAll('_', ' '), " confirmed in transaction ").concat(receipt.hash, ".").concat(id, " The next ledger is unavailable.").concat(recovery)), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "method", void 0), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "receipt", void 0), this.method = method, this.receipt = receipt;
        this.name = 'ConfirmedStageError';
    }
}
function decodeMarginPoolRegistry(raw) {
    if (raw.type !== 'scvMap' || raw.map === null) throw new Error('Unexpected pool registry response.');
    return raw.map.map((entry)=>{
        if (entry.key.type !== 'scvBytes' || entry.key.bytes.value.length !== 32 || entry.val.type !== 'scvAddress') throw new Error('Invalid pool registry entry.');
        return {
            poolId: new Uint8Array(entry.key.bytes.value),
            pool: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromScVal(entry.val).toString()
        };
    });
}
const YEAR_SECONDS = 31_536_000n, MAX_APR = 10_000_000n, SIGNING_HEADROOM_SECONDS = 600n;
const ceilDiv = (n, d)=>(n + d - 1n) / d;
function accruedCloseTarget(debt, annualRate, lastUpdate, now) {
    if (debt <= 0n || annualRate < 0n || annualRate > MAX_APR || lastUpdate < 0n || now < lastUpdate) throw new Error('Invalid debt accrual state. Refresh chain data.');
    const elapsed = now - lastUpdate;
    const interest = ceilDiv((debt + 1n) * (annualRate * elapsed + MAX_APR * SIGNING_HEADROOM_SECONDS), SCALE * YEAR_SECONDS) + 1n;
    // An unexpectedly stale snapshot must be accrued on chain, not silently over-sized.
    if (interest > ceilDiv(debt, 10n) + 2n) throw new Error('Debt accrual exceeds the 10% close headroom. Refresh market interest before resuming; an unswapped close can be cancelled.');
    return bufferedDebt(debt + interest);
}
function closeQuoteTarget(target, slippageBps, protocolSlippage) {
    minOutput(target, slippageBps);
    if (protocolSlippage < 0n || protocolSlippage >= SCALE) throw new Error('Invalid close slippage configuration.');
    const user = BigInt(slippageBps) * 100n, allowed = user < protocolSlippage ? user : protocolSlippage;
    return ceilDiv(target * SCALE, SCALE - allowed);
}
function closeAccrualApr(modelMaximum, staticRate) {
    if (typeof modelMaximum !== 'bigint' || modelMaximum < 0n || typeof staticRate !== 'bigint' || staticRate < 0n || staticRate > MAX_APR) throw new Error('Invalid borrow rate bound. Refresh chain data.');
    const bound = modelMaximum > staticRate ? modelMaximum : staticRate;
    return bound > MAX_APR ? MAX_APR : bound;
}
function decodeDebtAccrualState(values) {
    const [lastUpdate, staticRate, model, index, snapshot] = values;
    if (typeof lastUpdate !== 'bigint' || lastUpdate < 0n || typeof staticRate !== 'bigint' || staticRate < 0n || staticRate > MAX_APR || typeof index !== 'bigint' || index <= 0n || !snapshot || typeof snapshot.principal !== 'bigint' || snapshot.principal < 0n || typeof snapshot.interest_index !== 'bigint' || snapshot.interest_index <= 0n || model !== undefined && typeof model !== 'string') throw new Error('Debt accrual storage is unavailable. Refresh before continuing.');
    if (model !== undefined) new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](model);
    return {
        lastUpdate,
        staticRate,
        model,
        debt: snapshot.principal * index / snapshot.interest_index
    };
}
async function closeDebtTarget(market, id) {
    const names = [
        'LastUpdateTime',
        'BorrowYearlyRateScaled',
        'InterestModel',
        'BorrowIndex'
    ];
    const keys = names.map((name)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["unitEnum"])(name));
    keys.push(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvSymbol('MarginBorrowSnapshots'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]));
    const ledgerKeys = keys.map((key)=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].LedgerKey.contractData(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].LedgerKeyContractData({
            contract: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](market.address).toScAddress(),
            key,
            durability: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ContractDataDurability.persistent
        })));
    const client = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getRpc"])();
    if ((await client.getNetwork()).passphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase) throw new Error('RPC network does not match the selected app network.');
    const response = await client.getLedgerEntries(...ledgerKeys);
    const values = ledgerKeys.map((key)=>{
        const entry = response.entries.find((e)=>e.key.toXDR('base64') === key.toXDR('base64'));
        if (!entry) return undefined;
        if (entry.val.type !== 'contractData') throw new Error('Unexpected vault storage response.');
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(entry.val.contractData.val);
    });
    const { lastUpdate, staticRate, model, debt } = decodeDebtAccrualState(values);
    // Factory JumpRateModel has nonnegative slopes and clamps utilization to 100%.
    // Full-utilization APR therefore bounds its current rate; retain static fallback.
    const modelMax = model === undefined ? staticRate : await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(model, 'get_borrow_rate', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(0n),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(1n),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(0n)
    ]);
    const apr = closeAccrualApr(modelMax, staticRate);
    return accruedCloseTarget(debt, apr, lastUpdate, BigInt(Math.floor(Date.now() / 1000)));
}
function openExecutionFloor(reviewedMinimum, current) {
    if (current.expectedOut < reviewedMinimum) throw new Error('Quote moved below your reviewed minimum. Review again.');
    return reviewedMinimum > current.minOut ? reviewedMinimum : current.minOut;
}
async function findRoute(ctx, margin, base) {
    const sorted = [
        margin,
        base
    ].sort((a, b)=>{
        const aa = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](a).toScAddress().toXDR(), bb = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](b).toScAddress().toXDR();
        for(let i = 0; i < aa.length; i++){
            if (aa[i] !== bb[i]) return aa[i] - bb[i];
        }
        return 0;
    });
    const { router } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$margin$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadMarginRegistry"])();
    if (typeof router !== 'string' || !router) throw new Error('Aquarius router is not configured for this network.');
    const pools = decodeMarginPoolRegistry(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContractRaw"])(router, 'get_pools', [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec(sorted.map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"]))
    ]));
    for (const { poolId, pool } of pools){
        const allowed = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(ctx.info.swap_adapter, 'is_pool_binding_allowed', [
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvBytes(poolId),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(pool)
        ]);
        if (!allowed || !await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(ctx.info.swap_adapter, 'is_pool_allowed', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(pool)
        ])) continue;
        const tokens = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(pool, 'get_tokens');
        if (tokens.length !== 2 || tokens.some((token, i)=>token !== sorted[i])) continue;
        return {
            pool,
            poolId: new Uint8Array(poolId),
            tokens
        };
    }
    throw new Error('No approved pool route connects these assets. Ask the group owner to configure one.');
}
async function poolQuote(route, inputToken, amount) {
    const i = route.tokens.indexOf(inputToken);
    if (i < 0 || route.tokens.length !== 2) throw new Error('Pool route does not contain this asset.');
    const out = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(route.pool, 'estimate_swap', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(i, 'u32'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(1 - i, 'u32'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(amount)
    ]);
    if (out <= 0n) throw new Error('Pool returned an empty quote.');
    return out;
}
async function quoteOpen(ctx, owner, margin, base, shares, leverage, side, slippageBps) {
    if (margin.address === base.address) throw new Error('Choose two different assets.');
    if (!ctx.info.enabled_markets.includes(margin.address) || !ctx.info.enabled_markets.includes(base.address)) throw new Error('Both markets must have leverage enabled.');
    if (margin.token.decimals !== 7 || base.token.decimals !== 7) throw new Error('This margin version supports tokens with seven decimals.');
    const collateral = side === 'Long' ? base : margin;
    const effective = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? effectiveLeverage(Number(ctx.info.cfg.max_leverage), collateral.config.collateral_factor) : Number(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDeployments"])().margin_factory, 'effective_max_leverage', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(ctx.group.id, 'u32'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(collateral.address)
    ]));
    if (!Number.isInteger(leverage) || leverage < 2 || leverage > Math.floor(effective)) throw new Error("Leverage must be an integer between 2 and ".concat(Math.floor(effective), "."));
    if (shares <= 0n) throw new Error('Enter margin greater than zero.');
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return {
        margin,
        base,
        side,
        shares,
        leverage,
        route: {
            pool: 'mock',
            poolId: new Uint8Array(32),
            tokens: [
                margin.token.address,
                base.token.address
            ]
        },
        minOut: shares * BigInt(leverage),
        expectedOut: shares * BigInt(leverage),
        feeShares: 0n,
        closeFeeBps: 0n,
        totalShares: shares,
        freeMargin: 0n,
        maxLeverage: effective,
        slippageBps
    };
    const pairArgs = [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(margin.token.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(base.token.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["unitEnum"])(side)
    ];
    const [pair, execution, fees, freeMargin, marginPrice, basePrice, route, exchangeRate, receiptBalance] = await Promise.all([
        read(ctx, 'get_perps_pair_config', pairArgs),
        read(ctx, 'get_perps_pair_execution_config', pairArgs),
        read(ctx, 'preview_open_fees_v3', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(shares),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(leverage)
        ]),
        read(ctx, 'get_margin_balance_ptokens', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(owner),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(margin.token.address)
        ]),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(ctx.group.controller, 'get_price_usd', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(margin.token.address)
        ]),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(ctx.group.controller, 'get_price_usd', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(base.token.address)
        ]),
        findRoute(ctx, margin.token.address, base.token.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(margin.address, 'get_exchange_rate'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(margin.address, 'get_ptoken_balance', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(owner)
        ])
    ]);
    if (!pair || !execution) throw new Error('The owner must configure this margin pair before trading.');
    if (leverage > Number(pair.max_leverage)) throw new Error('Leverage exceeds this pair limit.');
    if (!marginPrice || !basePrice || marginPrice[0] <= 0n || basePrice[0] <= 0n) throw new Error('A fresh oracle price is unavailable.');
    if (exchangeRate <= 0n) throw new Error('Invalid margin exchange rate.');
    const underlying = shares * exchangeRate / SCALE;
    const trade = openTradeAmount(underlying, leverage, side, marginPrice, basePrice);
    const expectedOut = await poolQuote(route, side === 'Long' ? margin.token.address : base.token.address, trade);
    const userMin = minOutput(expectedOut, slippageBps), protocolMin = expectedOut * (SCALE - execution.open_slippage_scaled) / SCALE;
    const minOut = userMin > protocolMin ? userMin : protocolMin;
    if (fees.total_required_ptokens > freeMargin + receiptBalance) throw new Error('Supply more margin collateral before opening this position.');
    return {
        margin: {
            ...margin,
            exchangeRate,
            receiptBalance
        },
        base,
        side,
        shares,
        leverage,
        route,
        minOut,
        expectedOut,
        feeShares: fees.open_fee_ptokens,
        closeFeeBps: fees.close_fee_bps,
        totalShares: fees.total_required_ptokens,
        freeMargin,
        maxLeverage: Math.min(effective, Number(pair.max_leverage)),
        slippageBps
    };
}
async function openPosition(ctx, quote, signer, onProgress) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        const id = BigInt(Date.now()), positions = mockPositions(ctx, signer.address);
        positions.push({
            id,
            owner: signer.address,
            side: quote.side,
            collateral_asset: quote.base.token.address,
            debt_asset: quote.margin.token.address,
            collateral_ptokens: quote.shares * BigInt(quote.leverage),
            status: 'Open',
            entry_price_scaled: 1000000n,
            opened_at: BigInt(Math.floor(Date.now() / 1000)),
            health: 2500000n,
            debt: quote.shares,
            collateralUnderlying: quote.shares * BigInt(quote.leverage),
            liquidationPrice: 0.5,
            perps: null,
            pendingOpen: null,
            execution: null,
            pendingClose: null
        });
        saveMock(ctx, signer.address, positions);
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'success',
            message: 'Demo position opened. No funds moved.'
        });
        return id;
    }
    if ((await positions(ctx, signer.address)).some((p)=>p.status === 'PendingOpen')) throw new Error('Resume or cancel the existing pending open before creating another position.');
    // A stale review is re-quoted before any signature.
    const current = await quoteOpen(ctx, signer.address, quote.margin, quote.base, quote.shares, quote.leverage, quote.side, quote.slippageBps);
    if (current.route.pool !== quote.route.pool || current.route.poolId.length !== quote.route.poolId.length || current.route.poolId.some((byte, i)=>byte !== quote.route.poolId[i])) throw new Error('The approved pool route changed. Review again.');
    if (current.expectedOut < quote.minOut) throw new Error('Quote moved below your reviewed minimum. Review again.');
    if (current.totalShares > quote.totalShares) throw new Error('Fees changed. Review again.');
    let transferred = false;
    let fresh = current;
    if (current.freeMargin < current.totalShares) {
        await write(ctx, 'transfer_spot_to_margin', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(quote.margin.token.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(current.totalShares - current.freeMargin)
        ], signer, onProgress);
        transferred = true;
    }
    let result;
    try {
        // Transfer may take several ledgers. Re-read execution settings and quote now.
        if (transferred) fresh = await quoteOpen(ctx, signer.address, quote.margin, quote.base, quote.shares, quote.leverage, quote.side, quote.slippageBps);
        if (fresh.route.pool !== quote.route.pool || fresh.route.poolId.length !== quote.route.poolId.length || fresh.route.poolId.some((byte, i)=>byte !== quote.route.poolId[i]) || fresh.totalShares > quote.totalShares) throw new Error('Route or fees changed. Review again.');
        const floor = openExecutionFloor(quote.minOut, fresh);
        result = await write(ctx, 'begin_open_position_v3', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(quote.margin.token.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(quote.base.token.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(quote.shares),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(quote.leverage),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["unitEnum"])(quote.side),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec(quote.route.tokens.map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvBytes(quote.route.poolId),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(quote.route.pool),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(floor)
        ], signer, onProgress);
    } catch (error) {
        if (transferred && error instanceof Error) error.message += ' The confirmed transfer remains recoverable: refresh positions first; if no pending open exists, use Return margin to supply below.';
        throw error;
    }
    const id = result.value;
    if (typeof id !== 'bigint' || id < 0n || id > 18446744073709551615n) throw new Error('Open was submitted but its position ID could not be decoded. Refresh positions before retrying.');
    await resumeOpen(ctx, id, signer, onProgress);
    return id;
}
async function resumeOpen(ctx, id, signer, onProgress) {
    const pending = await read(ctx, 'get_pending_perps_open', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]);
    if (!pending) throw new Error('No pending open found. Refresh positions.');
    const execution = await read(ctx, 'get_pending_perps_open_execution', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]);
    if (!execution && pending.expires_at < BigInt(Math.floor(Date.now() / 1000))) throw new Error('This unswapped open expired. Cancel pending open to recover its margin.');
    if (!execution) await write(ctx, 'swap_open_position_v3', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ], signer, onProgress);
    await write(ctx, 'activate_open_position_v3', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ], signer, onProgress);
}
async function cancelOpen(ctx, id, signer, onProgress) {
    if (await read(ctx, 'get_pending_perps_open_execution', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ])) throw new Error('This open has already swapped. Resume activation to recover it.');
    return write(ctx, 'cancel_pending_open_v3', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ], signer, onProgress);
}
async function positions(ctx, owner) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return mockPositions(ctx, owner);
    const ids = await read(ctx, 'get_user_positions', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(owner)
    ]);
    return (await Promise.all(ids.map(async (id)=>{
        const raw = await read(ctx, 'get_position', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ]);
        if (!raw) return null;
        const status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["enumName"])(raw.status), side = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["enumName"])(raw.side);
        if (raw.owner !== owner) throw new Error('Position owner does not match the selected account.');
        if (![
            'Long',
            'Short'
        ].includes(side) || ![
            'PendingOpen',
            'Open',
            'Closing',
            'Closed',
            'Liquidated'
        ].includes(status)) throw new Error('Unsupported position state.');
        if (status === 'Closed') return null;
        const [perps, pendingOpen, execution, pendingClose] = await Promise.all([
            read(ctx, 'get_perps_position', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
            ]),
            read(ctx, 'get_pending_perps_open', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
            ]),
            read(ctx, 'get_pending_perps_open_execution', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
            ]),
            read(ctx, 'get_pending_perps_close', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
            ])
        ]);
        const collateral = ctx.markets.find((m)=>m.token.address === raw.collateral_asset), debtMarket = ctx.markets.find((m)=>m.token.address === raw.debt_asset);
        if (!collateral || !debtMarket) throw new Error('A position references a market outside this group.');
        const debt = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(debtMarket.address, 'get_margin_borrow_balance', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ]);
        const collateralUnderlying = collateral ? raw.collateral_ptokens * collateral.exchangeRate / SCALE : 0n;
        const health = status === 'Open' ? await read(ctx, 'get_health_factor', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ]) : null;
        let liquidationPrice = null;
        if (perps) liquidationPrice = liquidationPriceEstimate(side, collateralUnderlying, debt, perps.maintenance_margin_scaled);
        return {
            ...raw,
            id,
            status,
            side,
            perps: perps || null,
            pendingOpen: pendingOpen || null,
            execution,
            pendingClose: pendingClose || null,
            health,
            debt,
            collateralUnderlying,
            liquidationPrice
        };
    }))).filter((p)=>p !== null);
}
async function closePosition(ctx, position, signer, slippageBps, onProgress) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        saveMock(ctx, signer.address, mockPositions(ctx, signer.address).filter((p)=>p.id !== position.id));
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'success',
            message: 'Demo position closed.'
        });
        return;
    }
    if (position.owner !== signer.address || ![
        'Open',
        'Closing'
    ].includes(position.status)) throw new Error('This position cannot be closed by the selected wallet.');
    const id = position.id, p = position.perps;
    if (!p) throw new Error('Position route is unavailable. Refresh and retry.');
    const route = {
        pool: p.pool,
        poolId: p.pool_id,
        tokens: p.pool_tokens
    };
    const debtMarket = ctx.markets.find((m)=>m.token.address === position.debt_asset);
    if (!debtMarket) throw new Error('Debt market is missing from this group.');
    const debt = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(debtMarket.address, 'get_margin_borrow_balance', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]);
    if (debt === 0n) {
        await write(ctx, 'release_debt_free_position_v3', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ], signer, onProgress);
        return;
    }
    let pending = await read(ctx, 'get_pending_perps_close', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]);
    const execution = await read(ctx, 'get_perps_pair_execution_config', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(p.margin_asset),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(p.base_asset),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["unitEnum"])(position.side)
    ]);
    if (!execution) throw new Error('Pair execution settings are unavailable.');
    const safeMin = (quote)=>{
        const user = minOutput(quote, slippageBps), protocol = quote * (SCALE - execution.close_slippage_scaled) / SCALE;
        return user > protocol ? user : protocol;
    };
    if (!pending) {
        const fullQuote = await poolQuote(route, position.collateral_asset, position.collateralUnderlying);
        if (fullQuote < await closeDebtTarget(debtMarket, id)) throw new Error('Pool proceeds cannot cover this position debt and interest buffer. No transaction was signed.');
        await write(ctx, 'prepare_close_position_v3', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ], signer, onProgress);
        pending = await read(ctx, 'get_pending_perps_close', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ]);
        if (!pending) throw new Error('Close preparation is confirmed. Refresh to load its pending state before continuing.');
    }
    if (!closeHasSwapped(pending) && pending.expires_at < BigInt(Math.floor(Date.now() / 1000))) throw new Error('This unswapped close expired. Cancel it to recover collateral, then review a new close.');
    if (!closeHasSwapped(pending) && pending.collateral_underlying === 0n) {
        await write(ctx, 'withdraw_close_position_v3', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ], signer, onProgress);
        pending = await read(ctx, 'get_pending_perps_close', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
        ]);
        if (!pending) throw new Error('Close withdrawal confirmed. Refresh chain state before continuing.');
    }
    if (closeHasSwapped(pending) && pending.received_debt_asset === 0n) throw new Error('The swap has settled but some debt remains. Review an explicit wallet repayment before continuing.');
    if (!closeHasSwapped(pending)) {
        if (pending.expires_at < BigInt(Math.floor(Date.now() / 1000))) throw new Error('This unswapped close expired. Cancel it to recover collateral, then review a new close.');
        if (position.side === 'Short') {
            const target = await closeDebtTarget(debtMarket, id);
            const input = await solveShortInput(pending.collateral_underlying, closeQuoteTarget(target, slippageBps, execution.close_slippage_scaled), (n)=>poolQuote(route, position.collateral_asset, n));
            const quote = await poolQuote(route, position.collateral_asset, input), floor = safeMin(quote), minOut = floor > target ? floor : target;
            await write(ctx, 'swap_close_short_position_v3', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64'),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(input),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(minOut)
            ], signer, onProgress);
        } else {
            const quote = await poolQuote(route, position.collateral_asset, pending.collateral_underlying), floor = safeMin(quote), target = await closeDebtTarget(debtMarket, id);
            if (quote < target) throw new Error('Pool quote no longer covers the debt. The close remains pending.');
            await write(ctx, 'swap_close_position_v3', [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64'),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(floor > target ? floor : target)
            ], signer, onProgress);
        }
    }
    await write(ctx, 'finish_close_position_v3', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ], signer, onProgress);
    const remaining = await read(ctx, 'get_position', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]);
    if (remaining) onProgress === null || onProgress === void 0 ? void 0 : onProgress({
        status: 'success',
        message: 'Close transaction confirmed. Settlement remains pending; refresh and resume if needed.'
    });
}
async function cancelClose(ctx, id, signer, onProgress) {
    const pending = await read(ctx, 'get_pending_perps_close', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ]);
    if (!pending || closeHasSwapped(pending)) throw new Error('Only an unswapped pending close can be cancelled.');
    return write(ctx, 'cancel_close_position_v3', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(id, 'u64')
    ], signer, onProgress);
}
async function withdrawMargin(ctx, market, signer, onProgress) {
    const free = await read(ctx, 'get_margin_balance_ptokens', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(market.token.address)
    ]);
    if (free <= 0n) throw new Error('No free margin available for this asset.');
    return write(ctx, 'transfer_margin_to_spot', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(market.token.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(free)
    ], signer, onProgress);
}
async function repayResidual(ctx, position, amount, signer, onProgress) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) throw new Error('The demo does not have residual settlement debt.');
    if (position.owner !== signer.address || amount <= 0n) throw new Error('Invalid repayment request.');
    const pending = await read(ctx, 'get_pending_perps_close', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(position.id, 'u64')
    ]);
    if (!pending || !closeHasSwapped(pending)) throw new Error('No swapped close needs repayment.');
    return write(ctx, 'repay_margin_position_v3', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addr"])(signer.address),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(position.id, 'u64'),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$group$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["uint"])(amount)
    ], signer, onProgress);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/aquarius-pools.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Aquarius asset registry: USDC pools, read only.
 *
 * Source order (see memory note "Aquarius /pools/ API is incomplete"):
 *   1. the router's on-chain `get_pools(tokens)` for USDC against a list of counterparties (authoritative),
 *   2. the Aquarius AMM HTTP API (broad, but it hides some live pools),
 *   3. a static list of pools verified in docs/handoff/11-ADDRESSES.md (so the page is never blank),
 *   4. demo data when the app runs with NEXT_PUBLIC_USE_MOCKS=true.
 * Everything here is pure or takes an injected reader so it is unit-testable in node. */ /** Minimum depth in whole USD of each pool side that price-router-ext requires before it serves an AquariusOnly price. */ __turbopack_context__.s([
    "AQUARIUS_API",
    ()=>AQUARIUS_API,
    "AQUARIUS_ROUTER",
    ()=>AQUARIUS_ROUTER,
    "COUNTERPARTIES",
    ()=>COUNTERPARTIES,
    "KNOWN_TOKENS",
    ()=>KNOWN_TOKENS,
    "MIN_DEPTH_USD",
    ()=>MIN_DEPTH_USD,
    "USDC_ADDRESS",
    ()=>USDC_ADDRESS,
    "apiFeeToBps",
    ()=>apiFeeToBps,
    "applyPoolFilter",
    ()=>applyPoolFilter,
    "demoPools",
    ()=>demoPools,
    "discoverChainPools",
    ()=>discoverChainPools,
    "fetchApiPools",
    ()=>fetchApiPools,
    "filterUsdcPairs",
    ()=>filterUsdcPairs,
    "formatFee",
    ()=>formatFee,
    "formatUsd",
    ()=>formatUsd,
    "isDollarToken",
    ()=>isDollarToken,
    "isStablePair",
    ()=>isStablePair,
    "isUsdc",
    ()=>isUsdc,
    "isVaultEligible",
    ()=>isVaultEligible,
    "loadAquariusPools",
    ()=>loadAquariusPools,
    "mergePools",
    ()=>mergePools,
    "pairLabel",
    ()=>pairLabel,
    "parseApiPools",
    ()=>parseApiPools,
    "registryPools",
    ()=>registryPools,
    "shortAddress",
    ()=>shortAddress,
    "sortPools",
    ()=>sortPools,
    "underlyingIndex",
    ()=>underlyingIndex,
    "vaultIneligibleReason",
    ()=>vaultIneligibleReason
]);
const MIN_DEPTH_USD = 500;
const MAINNET_TOKENS = {
    CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA: 'XLM',
    CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: 'USDC',
    CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV: 'EURC',
    CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2: 'PYUSD',
    CBZVSNVB55ANF24QVJL2K5QCLOAB6XITGTGXYEAF6NPTXYKEJUYQOHFC: 'yXLM',
    CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK: 'AQUA',
    CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY: 'BLND'
};
const TESTNET_TOKENS = {
    CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: 'XLM',
    CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA: 'USDC',
    CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU: 'USDC',
    CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY: 'USDT',
    CDNVQW44C3HALYNVQ4SOBXY5EWYTGVYXX6JPESOLQDABJI5FC5LTRRUE: 'AQUA',
    CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF: 'BLND'
};
const KNOWN_TOKENS = {
    mainnet: MAINNET_TOKENS,
    testnet: TESTNET_TOKENS
};
const USDC_ADDRESS = {
    mainnet: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    testnet: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
};
const COUNTERPARTIES = {
    mainnet: [
        'EURC',
        'PYUSD',
        'XLM',
        'yXLM',
        'AQUA'
    ].map((s)=>addressOf('mainnet', s)).filter(Boolean),
    testnet: [
        'XLM',
        'AQUA'
    ].map((s)=>addressOf('testnet', s)).filter(Boolean)
};
function addressOf(net, symbol) {
    var _Object_entries_find;
    var _Object_entries_find_;
    return (_Object_entries_find_ = (_Object_entries_find = Object.entries(KNOWN_TOKENS[net]).find((param)=>{
        let [, s] = param;
        return s === symbol;
    })) === null || _Object_entries_find === void 0 ? void 0 : _Object_entries_find[0]) !== null && _Object_entries_find_ !== void 0 ? _Object_entries_find_ : '';
}
const AQUARIUS_ROUTER = {
    mainnet: 'CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK',
    testnet: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD'
};
const AQUARIUS_API = {
    mainnet: 'https://amm-api.aqua.network/api/external/v2',
    testnet: 'https://amm-api-testnet.aqua.network/api/external/v2'
};
function isUsdc(net, token) {
    return token.symbol === 'USDC' || token.address === USDC_ADDRESS[net];
}
function isDollarToken(net, token) {
    return isUsdc(net, token) || net === 'testnet' && token.symbol === 'USDT';
}
const STABLE_SYMBOLS = new Set([
    'USDC',
    'EURC',
    'PYUSD',
    'USDT',
    'USDx'
]);
function isStablePair(pool) {
    return pool.tokens.every((t)=>STABLE_SYMBOLS.has(t.symbol));
}
function underlyingIndex(net, pool) {
    if (isUsdc(net, pool.tokens[0])) return 0;
    if (isUsdc(net, pool.tokens[1])) return 1;
    if (isDollarToken(net, pool.tokens[0])) return 0;
    if (isDollarToken(net, pool.tokens[1])) return 1;
    return null;
}
function pairLabel(pool) {
    return "".concat(pool.tokens[0].symbol, "/").concat(pool.tokens[1].symbol);
}
function isVaultEligible(pool) {
    return pool.type === 'concentrated';
}
function vaultIneligibleReason(pool) {
    if (isVaultEligible(pool)) return null;
    const kind = pool.type === 'constant_product' ? 'a constant product pool' : pool.type === 'stable' ? 'a stable swap pool' : 'a pool of unknown type';
    return "This is ".concat(kind, ". The Aquarius LP vault needs a concentrated liquidity pool.");
}
function formatFee(feeBps) {
    if (feeBps === null || !Number.isFinite(feeBps)) return 'n/a';
    return "".concat((feeBps / 100).toFixed(2), "%");
}
function formatUsd(value) {
    if (value === null || !Number.isFinite(value)) return 'n/a';
    if (value >= 1e9) return "$".concat((value / 1e9).toFixed(2), "B");
    if (value >= 1e6) return "$".concat((value / 1e6).toFixed(2), "M");
    if (value >= 1e3) return "$".concat((value / 1e3).toFixed(1), "K");
    return "$".concat(value.toFixed(0));
}
function shortAddress(a) {
    return a.length > 14 ? "".concat(a.slice(0, 6), "...").concat(a.slice(-6)) : a;
}
function sortPools(pools) {
    return [
        ...pools
    ].sort((a, b)=>{
        var _a_tvlUsd, _b_tvlUsd;
        const av = (_a_tvlUsd = a.tvlUsd) !== null && _a_tvlUsd !== void 0 ? _a_tvlUsd : -1, bv = (_b_tvlUsd = b.tvlUsd) !== null && _b_tvlUsd !== void 0 ? _b_tvlUsd : -1;
        if (av !== bv) return bv - av;
        const ac = isVaultEligible(a) ? 0 : 1, bc = isVaultEligible(b) ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return pairLabel(a).localeCompare(pairLabel(b)) || a.address.localeCompare(b.address);
    });
}
function filterUsdcPairs(net, pools) {
    return pools.filter((p)=>p.tokens.some((t)=>isDollarToken(net, t)));
}
function applyPoolFilter(pools, filter) {
    let query = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : '';
    const q = query.trim().toLowerCase();
    return pools.filter((p)=>(filter === 'all' || isVaultEligible(p)) && (!q || pairLabel(p).toLowerCase().includes(q) || p.address.toLowerCase().includes(q)));
}
function mergePools() {
    for(var _len = arguments.length, lists = new Array(_len), _key = 0; _key < _len; _key++){
        lists[_key] = arguments[_key];
    }
    const byAddress = new Map();
    for (const list of lists)for (const p of list){
        const old = byAddress.get(p.address);
        if (!old) {
            byAddress.set(p.address, p);
            continue;
        }
        var _old_feeBps, _old_tvlUsd, _old_volumeUsd, _old_poolIndex;
        byAddress.set(p.address, {
            ...old,
            type: old.type === 'unknown' ? p.type : old.type,
            feeBps: (_old_feeBps = old.feeBps) !== null && _old_feeBps !== void 0 ? _old_feeBps : p.feeBps,
            tvlUsd: (_old_tvlUsd = old.tvlUsd) !== null && _old_tvlUsd !== void 0 ? _old_tvlUsd : p.tvlUsd,
            volumeUsd: (_old_volumeUsd = old.volumeUsd) !== null && _old_volumeUsd !== void 0 ? _old_volumeUsd : p.volumeUsd,
            poolIndex: (_old_poolIndex = old.poolIndex) !== null && _old_poolIndex !== void 0 ? _old_poolIndex : p.poolIndex
        });
    }
    return [
        ...byAddress.values()
    ];
}
// ---------- API ----------
function symbolFromApi(str) {
    if (str === 'native') return 'XLM';
    const code = str.split(':')[0];
    return code || str;
}
function toType(raw) {
    return raw === 'constant_product' || raw === 'stable' || raw === 'concentrated' ? raw : 'unknown';
}
function apiFeeToBps(fee) {
    const n = typeof fee === 'string' || typeof fee === 'number' ? Number(fee) : NaN;
    return Number.isFinite(n) && n >= 0 && n < 1 ? Math.round(n * 10_000) : null;
}
function parseApiPools(net, body) {
    var _this;
    const results = (_this = body) === null || _this === void 0 ? void 0 : _this.results;
    if (!Array.isArray(results)) throw new Error('Aquarius API returned an unexpected response.');
    const out = [];
    for (const row of results){
        if (!row || typeof row !== 'object') continue;
        const r = row;
        const addrs = r.tokens_addresses, strs = r.tokens_str;
        if (typeof r.address !== 'string' || !Array.isArray(addrs) || addrs.length !== 2 || !addrs.every((a)=>typeof a === 'string')) continue;
        const labels = Array.isArray(strs) && strs.length === 2 ? strs.map((s)=>symbolFromApi(String(s))) : [];
        const tokens = addrs.map((address, i)=>{
            var _KNOWN_TOKENS_net_address, _ref;
            return {
                address,
                symbol: (_ref = (_KNOWN_TOKENS_net_address = KNOWN_TOKENS[net][address]) !== null && _KNOWN_TOKENS_net_address !== void 0 ? _KNOWN_TOKENS_net_address : labels[i]) !== null && _ref !== void 0 ? _ref : shortAddress(address)
            };
        });
        out.push({
            address: r.address,
            poolIndex: typeof r.index === 'string' ? r.index : undefined,
            tokens,
            type: toType(r.pool_type),
            feeBps: apiFeeToBps(r.fee),
            tvlUsd: null,
            volumeUsd: null,
            source: 'api'
        });
    }
    return out;
}
async function fetchApiPools(net, fetchFn) {
    let opts = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    var _opts_pages, _opts_timeoutMs;
    const pages = (_opts_pages = opts.pages) !== null && _opts_pages !== void 0 ? _opts_pages : 3, timeoutMs = (_opts_timeoutMs = opts.timeoutMs) !== null && _opts_timeoutMs !== void 0 ? _opts_timeoutMs : 8000;
    const all = [];
    for(let page = 1; page <= pages; page++){
        const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), timeoutMs);
        try {
            const res = await fetchFn("".concat(AQUARIUS_API[net], "/pools/?size=200&page=").concat(page), {
                signal: ctl.signal
            });
            if (!res.ok) {
                if (page > 1 && res.status === 404) break;
                throw new Error("Aquarius API answered ".concat(res.status, "."));
            }
            const body = await res.json();
            all.push(...parseApiPools(net, body));
            if (!body.next) break;
        } finally{
            clearTimeout(timer);
        }
    }
    return filterUsdcPairs(net, all);
}
async function discoverChainPools(net, reader) {
    let counterparties = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : COUNTERPARTIES[net];
    const usdc = USDC_ADDRESS[net];
    const found = new Map();
    const failures = [];
    await Promise.all(counterparties.filter((c)=>c !== usdc).map(async (other)=>{
        try {
            const pools = await reader.getPools([
                usdc,
                other
            ]);
            await Promise.all(pools.map(async (param)=>{
                let { pool, poolIndex } = param;
                const info = await reader.poolInfo(pool);
                if (info.tokens.length !== 2) return;
                const tokens = info.tokens.map((address)=>{
                    var _KNOWN_TOKENS_net_address;
                    return {
                        address,
                        symbol: (_KNOWN_TOKENS_net_address = KNOWN_TOKENS[net][address]) !== null && _KNOWN_TOKENS_net_address !== void 0 ? _KNOWN_TOKENS_net_address : shortAddress(address)
                    };
                });
                const usdcIdx = tokens.findIndex((t)=>t.address === usdc);
                // Constant product and stable pools are balanced in value, concentrated ones are not; the estimate is labelled approximate in the UI.
                const tvlUsd = info.reserves && usdcIdx >= 0 && info.reserves[usdcIdx] !== undefined ? Number(info.reserves[usdcIdx]) / 1e7 * 2 : null;
                found.set(pool, {
                    address: pool,
                    poolIndex,
                    tokens,
                    type: info.type,
                    feeBps: info.feeBps,
                    tvlUsd,
                    volumeUsd: null,
                    source: 'chain'
                });
            }));
        } catch (e) {
            failures.push(e);
        }
    }));
    if (found.size === 0 && failures.length > 0) throw failures[0] instanceof Error ? failures[0] : new Error('Router lookup failed.');
    return [
        ...found.values()
    ];
}
// ---------- static registry and demo ----------
function p(net, address, a, b, type, feeBps, tvlUsd, source) {
    const tok = (s)=>({
            symbol: s,
            address: addressOf(net, s) || s
        });
    return {
        address,
        tokens: [
            tok(a),
            tok(b)
        ],
        type,
        feeBps,
        tvlUsd,
        volumeUsd: null,
        source
    };
}
function registryPools(net) {
    if (net === 'testnet') return [
        {
            address: 'CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I',
            tokens: [
                {
                    symbol: 'USDT',
                    address: addressOf('testnet', 'USDT')
                },
                {
                    symbol: 'XLM',
                    address: addressOf('testnet', 'XLM')
                }
            ],
            type: 'concentrated',
            feeBps: 30,
            tvlUsd: null,
            volumeUsd: null,
            source: 'registry'
        },
        {
            address: 'CCMNSENXDBNJSY72BDIPH5CCXLLHBKZ4LXTRKDLKZN4UI2NJFQLWTLD6',
            tokens: [
                {
                    symbol: 'USDT',
                    address: addressOf('testnet', 'USDT')
                },
                {
                    symbol: 'XLM',
                    address: addressOf('testnet', 'XLM')
                }
            ],
            type: 'constant_product',
            feeBps: 30,
            tvlUsd: null,
            volumeUsd: null,
            source: 'registry'
        }
    ];
    return [
        p(net, 'CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA', 'USDC', 'EURC', 'concentrated', 30, null, 'registry'),
        p(net, 'CB37QM6EHVBDDNK7MAVQESV7WPLKV6G36TR7MHAOYWPZXLPQUWSDOK4E', 'USDC', 'EURC', 'constant_product', 30, null, 'registry'),
        p(net, 'CAPIOQNULTKVYOJT6X2W2XKGNIVUWZDY72Y42YG6HQKJ7DU7YTHIDQYX', 'PYUSD', 'USDC', 'concentrated', 10, null, 'registry'),
        p(net, 'CDMH535JSD224YXPET3B4SJOLXTQQ24GRSCWACGYBKSH2DKFJYWI7SUW', 'PYUSD', 'USDC', 'stable', 10, null, 'registry'),
        p(net, 'CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV', 'XLM', 'USDC', 'constant_product', 30, null, 'registry'),
        p(net, 'CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O', 'AQUA', 'USDC', 'constant_product', 30, 520_000, 'registry')
    ];
}
function demoPools(net) {
    const tvl = {
        CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA: 412_000,
        CAPIOQNULTKVYOJT6X2W2XKGNIVUWZDY72Y42YG6HQKJ7DU7YTHIDQYX: 186_000,
        CB37QM6EHVBDDNK7MAVQESV7WPLKV6G36TR7MHAOYWPZXLPQUWSDOK4E: 64_000,
        CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O: 520_000,
        CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV: 91_000
    };
    return registryPools(net).map((pool)=>{
        var _tvl_pool_address;
        return {
            ...pool,
            tvlUsd: (_tvl_pool_address = tvl[pool.address]) !== null && _tvl_pool_address !== void 0 ? _tvl_pool_address : pool.tvlUsd,
            source: 'demo'
        };
    });
}
async function loadAquariusPools(deps) {
    const { net, demo } = deps;
    if (demo) return {
        pools: sortPools(demoPools(net)),
        sources: {
            chain: 'skipped',
            api: 'skipped'
        },
        primary: 'demo',
        warnings: []
    };
    const warnings = [];
    const sources = {
        chain: 'skipped',
        api: 'skipped'
    };
    const [chainRes, apiRes] = await Promise.allSettled([
        deps.chain ? discoverChainPools(net, deps.chain) : Promise.reject(new Error('skip')),
        deps.fetchFn ? fetchApiPools(net, deps.fetchFn) : Promise.reject(new Error('skip'))
    ]);
    let chainPools = [], apiPools = [];
    if (deps.chain) {
        if (chainRes.status === 'fulfilled') {
            chainPools = chainRes.value;
            sources.chain = 'ok';
        } else {
            sources.chain = 'error';
            warnings.push("On-chain router lookup failed: ".concat(chainRes.reason instanceof Error ? chainRes.reason.message : 'unknown error', "."));
        }
    }
    if (deps.fetchFn) {
        if (apiRes.status === 'fulfilled') {
            apiPools = apiRes.value;
            sources.api = 'ok';
        } else {
            sources.api = 'error';
            warnings.push("Aquarius API unavailable: ".concat(apiRes.reason instanceof Error ? apiRes.reason.message : 'unknown error', "."));
        }
    }
    const merged = mergePools(chainPools, apiPools);
    if (merged.length === 0) {
        warnings.push('Showing the verified pool list shipped with this app instead.');
        return {
            pools: sortPools(registryPools(net)),
            sources,
            primary: 'registry',
            warnings
        };
    }
    // Verified pools that neither live source returned still appear, so a hidden pool never disappears from the page.
    const withRegistry = mergePools(merged, registryPools(net));
    return {
        pools: sortPools(withRegistry),
        sources,
        primary: chainPools.length ? 'chain' : 'api',
        warnings
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/aquarius-chain.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "chainReader",
    ()=>chainReader
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$buffer$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/compiled/buffer/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$margin$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/margin.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/aquarius-pools.ts [app-client] (ecmascript)");
;
;
;
;
const addr = (a)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](a).toScVal();
const toHex = (b)=>Array.from(b, (x)=>x.toString(16).padStart(2, '0')).join('');
function sortedPair(tokens) {
    const [a, b] = tokens.map((t)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](t).toScAddress().toXDR());
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$buffer$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Buffer"].compare(a, b) <= 0 ? tokens : [
        tokens[1],
        tokens[0]
    ];
}
async function tryRead(pool, method) {
    try {
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(pool, method);
    } catch (e) {
        return null;
    }
}
function normalizeType(raw) {
    return raw === 'concentrated' || raw === 'stable' || raw === 'constant_product' ? raw : 'unknown';
}
function chainReader(net) {
    const router = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AQUARIUS_ROUTER"][net];
    return {
        async getPools (tokens) {
            const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContractRaw"])(router, 'get_pools', [
                __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec(sortedPair(tokens).map(addr))
            ]);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$margin$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["decodeMarginPoolRegistry"])(raw).map((param)=>{
                let { poolId, pool } = param;
                return {
                    poolIndex: toHex(poolId),
                    pool
                };
            });
        },
        async poolInfo (pool) {
            const [tokens, type, fee, reserves] = await Promise.all([
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(pool, 'get_tokens'),
                tryRead(pool, 'pool_type'),
                tryRead(pool, 'get_fee_fraction'),
                tryRead(pool, 'get_reserves')
            ]);
            // Aquarius stores the fee as a fraction of 10_000 (30 = 0.30%).
            const feeBps = fee === null || fee === undefined ? null : Number(fee);
            return {
                tokens: tokens.map(String),
                type: normalizeType(type !== null && typeof type === 'object' ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(type) : type),
                feeBps: feeBps !== null && Number.isFinite(feeBps) && feeBps >= 0 && feeBps <= 10_000 ? feeBps : null,
                reserves: Array.isArray(reserves) ? reserves.map((r)=>BigInt(r)) : null
            };
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/vaults/useAquariusPools.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAquariusPools",
    ()=>useAquariusPools
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$chain$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/aquarius-chain.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/aquarius-pools.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const LOAD_TIMEOUT_MS = 15_000;
function useAquariusPools() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        loading: true,
        result: null
    });
    const run = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    const load = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAquariusPools.useCallback[load]": ()=>{
            const id = ++run.current;
            setState({
                "useAquariusPools.useCallback[load]": (s)=>({
                        loading: true,
                        result: s.result
                    })
            }["useAquariusPools.useCallback[load]"]);
            const net = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name;
            const canRead = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks || !(net === 'mainnet' && !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].rpcUrl);
            const real = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadAquariusPools"])({
                net,
                demo: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks,
                chain: !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks && canRead ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$chain$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["chainReader"])(net) : null,
                fetchFn: !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks && typeof fetch === 'function' ? ({
                    "useAquariusPools.useCallback[load].real": (url, init)=>fetch(url, init)
                })["useAquariusPools.useCallback[load].real"] : null
            });
            // The page must never hang on a slow source: after the timeout the verified list is shown with a warning.
            const timeout = new Promise({
                "useAquariusPools.useCallback[load]": (resolve)=>setTimeout({
                        "useAquariusPools.useCallback[load]": ()=>resolve({
                                pools: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sortPools"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["registryPools"])(net)),
                                sources: {
                                    chain: 'error',
                                    api: 'error'
                                },
                                primary: 'registry',
                                warnings: [
                                    'Aquarius sources were too slow. Showing the verified pool list shipped with this app.'
                                ]
                            })
                    }["useAquariusPools.useCallback[load]"], LOAD_TIMEOUT_MS)
            }["useAquariusPools.useCallback[load]"]);
            Promise.race([
                real,
                timeout
            ]).catch({
                "useAquariusPools.useCallback[load]": ()=>({
                        pools: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["sortPools"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["registryPools"])(net)),
                        sources: {
                            chain: 'error',
                            api: 'error'
                        },
                        primary: 'registry',
                        warnings: [
                            'Pools could not be loaded. Showing the verified pool list shipped with this app.'
                        ]
                    })
            }["useAquariusPools.useCallback[load]"]).then({
                "useAquariusPools.useCallback[load]": (result)=>{
                    if (id === run.current) setState({
                        loading: false,
                        result
                    });
                }
            }["useAquariusPools.useCallback[load]"]);
        }
    }["useAquariusPools.useCallback[load]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAquariusPools.useEffect": ()=>{
            load();
        }
    }["useAquariusPools.useEffect"], [
        load
    ]);
    return {
        ...state,
        reload: load
    };
}
_s(useAquariusPools, "oovPO5SjfIIRDGMmUqr0oba2iRs=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/kinds/schema.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Generic, schema-driven validation and encoding shared by every vault kind. */ __turbopack_context__.s([
    "defaultValues",
    ()=>defaultValues,
    "encodeField",
    ()=>encodeField,
    "encodeFields",
    ()=>encodeFields,
    "formatScaled",
    ()=>formatScaled,
    "isValid",
    ()=>isValid,
    "parseScaled",
    ()=>parseScaled,
    "rawNumber",
    ()=>rawNumber,
    "validateField",
    ()=>validateField,
    "validateKind",
    ()=>validateKind
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
;
function defaultValues(kind, ctx) {
    const out = {};
    for (const f of kind.fields)out[f.key] = typeof f.default === 'function' ? f.default(ctx) : f.default;
    return out;
}
const DEC = /^\d+(\.\d+)?$/;
function parseScaled(text, decimals) {
    const t = text.trim();
    if (!DEC.test(t)) return null;
    const [whole, frac = ''] = t.split('.');
    if (frac.length > decimals) return null;
    return BigInt(whole + frac.padEnd(decimals, '0'));
}
/** Number of decimals a `scale` of 10^k implies, or null when scale is not a power of ten (e.g. 60 minutes). */ function scaleDecimals(scale) {
    const k = Math.round(Math.log10(scale));
    return 10 ** k === scale ? k : null;
}
function rawNumber(f, text, ctx) {
    if (f.input === 'amount') return parseScaled(text, ctx.decimals);
    var _f_scale;
    const scale = (_f_scale = f.scale) !== null && _f_scale !== void 0 ? _f_scale : 1;
    const dec = scaleDecimals(scale);
    if (dec !== null) return parseScaled(text, dec);
    // Non power-of-ten scale (minutes to seconds): integers or finite decimals that multiply to a whole number.
    const n = Number(text);
    if (!DEC.test(text.trim()) || !Number.isFinite(n)) return null;
    const raw = n * scale;
    return Math.abs(raw - Math.round(raw)) < 1e-9 ? BigInt(Math.round(raw)) : null;
}
function validateField(f, text, ctx) {
    const v = (text !== null && text !== void 0 ? text : '').trim();
    if (!v) return f.required === false ? null : "".concat(f.label, " is required.");
    switch(f.input){
        case 'address':
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(v) || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidEd25519PublicKey(v) ? null : "".concat(f.label, " must be a Stellar address (G... or C...).");
        case 'select':
            var _f_options;
            return ((_f_options = f.options) === null || _f_options === void 0 ? void 0 : _f_options.some((o)=>o.value === v)) ? null : "Choose one of the listed ".concat(f.label.toLowerCase(), " options.");
        case 'toggle':
            return v === 'true' || v === 'false' ? null : 'Choose on or off.';
        case 'text':
            return null;
        default:
            {
                const raw = rawNumber(f, v, ctx);
                if (raw === null) return "".concat(f.label, " must be a number").concat(f.input === 'amount' ? " with at most ".concat(ctx.decimals, " decimals") : '', ".");
                if (f.input === 'number' && f.step !== undefined && f.step >= 1 && Number(v) % 1 !== 0) return "".concat(f.label, " must be a whole number.");
                const n = Number(v);
                if (f.min !== undefined && n < f.min) return "".concat(f.label, " must be at least ").concat(f.min).concat(f.unit ? ' ' + f.unit : '', ".");
                if (f.max !== undefined && n > f.max) return "".concat(f.label, " must be at most ").concat(f.max).concat(f.unit ? ' ' + f.unit : '', ".");
                return null;
            }
    }
}
function validateKind(kind, values, ctx) {
    const errors = {};
    for (const f of kind.fields){
        var _values_f_key;
        const e = validateField(f, (_values_f_key = values[f.key]) !== null && _values_f_key !== void 0 ? _values_f_key : '', ctx);
        if (e) errors[f.key] = e;
    }
    const extra = Object.keys(errors).length === 0 && kind.validate ? kind.validate(values, ctx) : {
        errors: {},
        warnings: []
    };
    return {
        errors: {
            ...extra.errors,
            ...errors
        },
        warnings: extra.warnings
    };
}
function encodeField(f, text, ctx) {
    const v = text.trim();
    switch(f.encoding){
        case 'address':
            return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"](v).toScVal();
        case 'bool':
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(v === 'true', {
                type: 'bool'
            });
        case 'symbol':
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(v, {
                type: 'symbol'
            });
        case 'u32':
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(Number(f.input === 'select' ? v : rawNumber(f, v, ctx)), {
                type: 'u32'
            });
        case 'u64':
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(f.input === 'select' ? BigInt(v) : rawNumber(f, v, ctx), {
                type: 'u64'
            });
        case 'i128':
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(rawNumber(f, v, ctx), {
                type: 'i128'
            });
    }
}
function encodeFields(kind, values, ctx) {
    return kind.fields.map((f)=>encodeField(f, values[f.key], ctx));
}
function isValid(v) {
    return Object.keys(v.errors).length === 0;
}
function formatScaled(raw, decimals) {
    const neg = raw < 0n;
    const s = (neg ? -raw : raw).toString().padStart(decimals + 1, '0');
    const whole = s.slice(0, s.length - decimals), frac = s.slice(s.length - decimals).replace(/0+$/, '');
    return "".concat(neg ? '-' : '').concat(whole).concat(frac ? '.' + frac : '');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/kinds/aquarius.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Aquarius ladder vault: capital laddered across several adjacent concentrated-liquidity ranges of one Aquarius pool.
 * Constructor (contracts/aquarius-vault): owner, pool, underlying, keeper, rungs, width_spacings, step_spacings, shape,
 * recenter_spacings, cooldown_secs, fee_bps, deposit_cap, slippage_bps. The ladder maths here MUST match the contract
 * (`ladder()` in contracts/aquarius-vault/src/ladder.rs); both are covered by tests on the same vectors. */ __turbopack_context__.s([
    "AQ_BOUNDS",
    ()=>AQ_BOUNDS,
    "SHAPES",
    ()=>SHAPES,
    "aquariusKind",
    ()=>aquariusKind,
    "ladder",
    ()=>ladder,
    "maxRecenterSpacings",
    ()=>maxRecenterSpacings,
    "tickSpacingForFee",
    ()=>tickSpacingForFee,
    "tickToPct",
    ()=>tickToPct
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/schema.ts [app-client] (ecmascript)");
;
const AQ_BOUNDS = {
    rungsMax: 7,
    widthMax: 200,
    stepMax: 200,
    recenterMax: 100,
    cooldownMinSecs: 300,
    cooldownMaxSecs: 7 * 86_400,
    feeMaxBps: 2000,
    slippageMaxBps: 500
};
const SHAPES = [
    {
        value: '0',
        label: 'Flat',
        hint: 'Equal capital in every rung.'
    },
    {
        value: '1',
        label: 'Pyramid',
        hint: 'Most capital in the middle rungs, closest to the price.'
    },
    {
        value: '2',
        label: 'Wings',
        hint: 'Most capital in the outer rungs: earns less now, keeps working after a big move.'
    }
];
function tickSpacingForFee(feeBps) {
    if (feeBps === 10) return 20;
    if (feeBps === 100) return 200;
    return 60;
}
function floorDiv(a, b) {
    return Math.floor(a / b);
}
function ladder(rungs, widthSp, stepSp, shape, spacing) {
    const startUnits = floorDiv(-((rungs - 1) * stepSp + widthSp), 2);
    const raw = [];
    for(let i = 0; i < rungs; i++){
        const d = Math.abs(2 * i - (rungs - 1));
        raw.push(shape === 1 ? rungs + 1 - d : shape === 2 ? 1 + d : 1);
    }
    const sum = raw.reduce((a, b)=>a + b, 0);
    const w = raw.map((r)=>Math.floor(r * 10_000 / sum));
    let rem = 10_000 - w.reduce((a, b)=>a + b, 0);
    // Remainder goes to the first rung with the largest raw weight (deterministic, identical on chain).
    const maxIdx = raw.indexOf(Math.max(...raw));
    w[maxIdx] += rem;
    rem = 0;
    return raw.map((_, i)=>({
            index: i,
            lowerTick: (startUnits + i * stepSp) * spacing,
            upperTick: (startUnits + i * stepSp + widthSp) * spacing,
            weightBps: w[i]
        }));
}
function tickToPct(tick) {
    return (Math.pow(1.0001, tick) - 1) * 100;
}
function maxRecenterSpacings(rungs, widthSp, stepSp) {
    return Math.max(1, Math.floor(((rungs - 1) * stepSp + widthSp) / 2));
}
function num(v, k) {
    return Number(v[k]);
}
function validate(v, ctx) {
    var _ctx_facts, _ctx_facts1, _ctx_facts2;
    const errors = {};
    const warnings = [];
    const rungs = num(v, 'rungs'), w = num(v, 'width'), s = num(v, 'step'), r = num(v, 'recenter');
    if (v.keeper && v.owner === v.keeper) warnings.push('The keeper is the owner. Fine for a demo; use a separate key for unattended rebalancing.');
    if (r > maxRecenterSpacings(rungs, w, s)) errors.recenter = "Rebalance trigger must be at most ".concat(maxRecenterSpacings(rungs, w, s), " spacings for this ladder, otherwise the price leaves the ladder before it rebalances.");
    if (s > w * 2) warnings.push('Large gaps between rungs leave price levels with no liquidity.');
    var _ctx_facts_tickSpacing;
    const spacing = (_ctx_facts_tickSpacing = (_ctx_facts = ctx.facts) === null || _ctx_facts === void 0 ? void 0 : _ctx_facts.tickSpacing) !== null && _ctx_facts_tickSpacing !== void 0 ? _ctx_facts_tickSpacing : tickSpacingForFee((_ctx_facts1 = ctx.facts) === null || _ctx_facts1 === void 0 ? void 0 : _ctx_facts1.feeBps);
    const half = ((rungs - 1) * s + w) * spacing / 2;
    if (half > 50_000) errors.width = 'The ladder would span more than about 50,000 ticks each side.';
    if (((_ctx_facts2 = ctx.facts) === null || _ctx_facts2 === void 0 ? void 0 : _ctx_facts2.feeBps) === 100) warnings.push('1% pools trade rarely: expect few fees.');
    return {
        errors,
        warnings
    };
}
function preview(v, ctx) {
    var _ctx_facts, _ctx_facts1;
    const rungs = num(v, 'rungs'), w = num(v, 'width'), s = num(v, 'step'), shape = num(v, 'shape');
    if (![
        rungs,
        w,
        s,
        shape
    ].every(Number.isFinite) || rungs < 1 || w < 1 || s < 1) return null;
    var _ctx_facts_tickSpacing;
    const spacing = (_ctx_facts_tickSpacing = (_ctx_facts = ctx.facts) === null || _ctx_facts === void 0 ? void 0 : _ctx_facts.tickSpacing) !== null && _ctx_facts_tickSpacing !== void 0 ? _ctx_facts_tickSpacing : tickSpacingForFee((_ctx_facts1 = ctx.facts) === null || _ctx_facts1 === void 0 ? void 0 : _ctx_facts1.feeBps);
    const rs = ladder(Math.min(rungs, AQ_BOUNDS.rungsMax), w, s, shape, spacing);
    const lo = rs[0].lowerTick, hi = rs[rs.length - 1].upperTick;
    return {
        type: 'ladder',
        title: 'Ladder preview',
        rungs: rs.map((r)=>({
                index: r.index,
                lowerPct: tickToPct(r.lowerTick),
                upperPct: tickToPct(r.upperTick),
                weightPct: r.weightBps / 100
            })),
        caption: "".concat(rs.length, " rung").concat(rs.length === 1 ? '' : 's', " from ").concat(tickToPct(lo).toFixed(1), "% to +").concat(tickToPct(hi).toFixed(1), "% around today's price (tick spacing ").concat(spacing, ").")
    };
}
function summary(v, ctx) {
    var _ctx_facts, _ctx_facts1, _ctx_facts_symbols, _ctx_facts2, _SHAPES_num;
    var _ctx_facts_tickSpacing;
    const spacing = (_ctx_facts_tickSpacing = (_ctx_facts = ctx.facts) === null || _ctx_facts === void 0 ? void 0 : _ctx_facts.tickSpacing) !== null && _ctx_facts_tickSpacing !== void 0 ? _ctx_facts_tickSpacing : tickSpacingForFee((_ctx_facts1 = ctx.facts) === null || _ctx_facts1 === void 0 ? void 0 : _ctx_facts1.feeBps);
    var _ctx_facts_symbols_v_underlying;
    const sym = (_ctx_facts_symbols_v_underlying = (_ctx_facts2 = ctx.facts) === null || _ctx_facts2 === void 0 ? void 0 : (_ctx_facts_symbols = _ctx_facts2.symbols) === null || _ctx_facts_symbols === void 0 ? void 0 : _ctx_facts_symbols[v.underlying]) !== null && _ctx_facts_symbols_v_underlying !== void 0 ? _ctx_facts_symbols_v_underlying : 'the underlying token';
    var _SHAPES_num_label;
    return [
        "Deposits and withdrawals are in ".concat(sym, ". Deposits stop at ").concat(v.cap, " ").concat(sym, "."),
        "".concat(v.rungs, " range").concat(num(v, 'rungs') === 1 ? '' : 's', ", each ").concat(num(v, 'width') * spacing, " ticks wide, ").concat(num(v, 'step') * spacing, ' ticks apart, "').concat((_SHAPES_num_label = (_SHAPES_num = SHAPES[num(v, 'shape')]) === null || _SHAPES_num === void 0 ? void 0 : _SHAPES_num.label) !== null && _SHAPES_num_label !== void 0 ? _SHAPES_num_label : '?', '" weighting.'),
        "The keeper may rebalance when the price drifts ".concat(num(v, 'recenter') * spacing, " ticks from the ladder centre, at most once every ").concat(v.cooldown, " minutes."),
        "You (the owner) take ".concat(v.fee, "% of earned fees as vault shares. The owner cannot withdraw depositors' funds.")
    ];
}
const aquariusKind = {
    id: 'aquarius',
    name: 'Aquarius ladder vault',
    tagline: 'Concentrated liquidity laddered across several price ranges',
    description: 'Deposit one token; the vault splits it into a ladder of adjacent Aquarius concentrated-liquidity ranges around the current price, earning swap fees and AQUA. A keeper recentres the ladder when the price drifts. Depositors can always leave, in kind if the pool is stressed.',
    status: 'live',
    risks: [
        'Impermanent loss: a ladder holds more of the falling token. A volatile pair can lose value against simply holding.',
        'Rebalancing swaps pay pool fees and can lose to price moves between ledgers; the vault caps slippage.',
        'Vault value is marked at the pool price, so a manipulated pool price affects share price. Deposit caps limit exposure.'
    ],
    fields: [
        {
            key: 'owner',
            label: 'Owner',
            help: 'Controls settings and pausing. Cannot withdraw other people\'s funds.',
            group: 'Pool',
            input: 'address',
            encoding: 'address',
            default: (ctx)=>ctx.owner,
            suggest: 'owner',
            locked: 'owner'
        },
        {
            key: 'pool',
            label: 'Aquarius pool',
            help: 'A concentrated-liquidity pool. Pick one of the listed pools or paste a pool contract address; the vault checks it on creation.',
            group: 'Pool',
            input: 'address',
            encoding: 'address',
            default: '',
            suggest: 'pools'
        },
        {
            key: 'underlying',
            label: 'Deposit token',
            help: 'The token depositors put in and take out. Must be one of the pool\'s two tokens.',
            group: 'Pool',
            input: 'address',
            encoding: 'address',
            default: '',
            suggest: 'pool-tokens'
        },
        {
            key: 'keeper',
            label: 'Keeper',
            help: 'The one address (besides you) allowed to rebalance. A keeper cannot move funds out of the vault.',
            group: 'Operations',
            input: 'address',
            encoding: 'address',
            default: (ctx)=>ctx.owner,
            suggest: 'owner'
        },
        {
            key: 'rungs',
            label: 'Rungs',
            help: 'How many adjacent price ranges (a "ladder" of positions). More rungs spread risk but cost more gas per rebalance.',
            group: 'Ladder',
            input: 'number',
            encoding: 'u32',
            unit: 'ranges',
            min: 1,
            max: AQ_BOUNDS.rungsMax,
            step: 1,
            default: '5'
        },
        {
            key: 'width',
            label: 'Rung width',
            help: 'Width of each range in tick spacings of the pool (one spacing is 0.2% to 2% of price depending on the pool fee). Narrow earns more per dollar while in range.',
            group: 'Ladder',
            input: 'number',
            encoding: 'u32',
            unit: 'spacings',
            min: 1,
            max: AQ_BOUNDS.widthMax,
            step: 1,
            default: '2'
        },
        {
            key: 'step',
            label: 'Rung spacing',
            help: 'Distance between rung starts, in tick spacings. Equal to the width makes touching ranges; smaller overlaps them; larger leaves gaps.',
            group: 'Ladder',
            input: 'number',
            encoding: 'u32',
            unit: 'spacings',
            min: 1,
            max: AQ_BOUNDS.stepMax,
            step: 1,
            default: '2'
        },
        {
            key: 'shape',
            label: 'Weighting',
            help: 'How capital is split across the rungs.',
            group: 'Ladder',
            input: 'select',
            encoding: 'u32',
            options: SHAPES.map((s)=>({
                    ...s
                })),
            default: '1'
        },
        {
            key: 'recenter',
            label: 'Rebalance trigger',
            help: 'The keeper may rebuild the ladder once the price is this many spacings from the ladder centre.',
            group: 'Operations',
            input: 'number',
            encoding: 'u32',
            unit: 'spacings',
            min: 1,
            max: AQ_BOUNDS.recenterMax,
            step: 1,
            default: '3'
        },
        {
            key: 'cooldown',
            label: 'Rebalance cooldown',
            help: 'Minimum time between rebalances. Short cooldowns follow the price closely and pay more swap fees.',
            group: 'Operations',
            input: 'number',
            encoding: 'u32',
            unit: 'minutes',
            min: AQ_BOUNDS.cooldownMinSecs / 60,
            max: AQ_BOUNDS.cooldownMaxSecs / 60,
            step: 1,
            scale: 60,
            default: '60'
        },
        {
            key: 'fee',
            label: 'Performance fee',
            help: 'Share of earned fees paid to the owner as vault shares. Hard maximum 20%.',
            group: 'Safety',
            input: 'number',
            encoding: 'u32',
            unit: '%',
            min: 0,
            max: AQ_BOUNDS.feeMaxBps / 100,
            step: 0.1,
            scale: 100,
            default: '10'
        },
        {
            key: 'cap',
            label: 'Deposit cap',
            help: 'Total deposits the vault accepts, in the deposit token. Keep it small while the vault is new.',
            group: 'Safety',
            input: 'amount',
            encoding: 'i128',
            unit: 'tokens',
            min: 1,
            step: 1,
            default: '1000'
        },
        {
            key: 'slippage',
            label: 'Max swap slippage',
            help: 'Rebalance and exit swaps revert if they would lose more than this versus the pool price. Between 0.5% and 5% (pool fees alone cost about 0.15% of a rebalance).',
            group: 'Safety',
            input: 'number',
            encoding: 'u32',
            unit: '%',
            min: 0.5,
            max: AQ_BOUNDS.slippageMaxBps / 100,
            step: 0.1,
            scale: 100,
            default: '1'
        }
    ],
    validate,
    preview,
    summary,
    // Constructor order differs from display order (owner, pool, underlying, keeper, rungs, width, step, shape, recenter, cooldown, fee, cap, slippage).
    encode (v, ctx) {
        const order = [
            'owner',
            'pool',
            'underlying',
            'keeper',
            'rungs',
            'width',
            'step',
            'shape',
            'recenter',
            'cooldown',
            'fee',
            'cap',
            'slippage'
        ];
        return order.map((k)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["encodeField"])(aquariusKind.fields.find((f)=>f.key === k), v[k], ctx));
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/kinds/types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Vault kind registry types. A kind = one Wasm registered in the vault-factory under `id`, plus a typed config schema
 * the app renders as a form and encodes into constructor arguments (`init_args`, owner first).
 * Pure data and helpers (no network access): safe in node unit tests and server rendering.
 *
 * To add a kind: create `kinds/<id>.ts` exporting a VaultKind, add it to `kinds/index.ts`. Nothing else changes:
 * the Create page, the live validation, the preview and "My vaults" are all driven by this schema. */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/kinds/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/** Registry of vault kinds the app can create. Sibling agents: add your kind here (one import, one array entry). */ __turbopack_context__.s([
    "VAULT_KINDS",
    ()=>VAULT_KINDS,
    "getKind",
    ()=>getKind,
    "liveKinds",
    ()=>liveKinds
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$aquarius$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/aquarius.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/schema.ts [app-client] (ecmascript)");
;
const VAULT_KINDS = [
    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$aquarius$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aquariusKind"]
];
function getKind(id) {
    return VAULT_KINDS.find((k)=>k.id === id);
}
function liveKinds() {
    return VAULT_KINDS.filter((k)=>k.status === 'live');
}
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/vaults/factory-client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Vault factory client: create a vault of any registered kind, list the caller's vaults. Reads manifests, never hard-coded ids.
 * Demo mode (NEXT_PUBLIC_USE_MOCKS=true) keeps a local list and never touches the chain. */ __turbopack_context__.s([
    "KeyValueMemory",
    ()=>KeyValueMemory,
    "createVault",
    ()=>createVault,
    "deployedKinds",
    ()=>deployedKinds,
    "listMyVaults",
    ()=>listMyVaults,
    "loadMockVaults",
    ()=>loadMockVaults,
    "randomSalt",
    ()=>randomSalt,
    "saveMockVault",
    ()=>saveMockVault,
    "vaultFactoryId",
    ()=>vaultFactoryId,
    "vaultManifest",
    ()=>vaultManifest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$buffer$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/compiled/buffer/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$mainnet$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/deployments/mainnet.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$testnet$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/deployments/testnet.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui-events.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/factory.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/schema.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
function vaultManifest() {
    let net = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name;
    return net === 'mainnet' ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$mainnet$2e$json__$28$json$29$__["default"] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$testnet$2e$json__$28$json$29$__["default"];
}
function vaultFactoryId() {
    let net = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name;
    const id = vaultManifest(net).vault_factory;
    return id && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(id) ? id : null;
}
function deployedKinds() {
    let net = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name;
    var _vaultManifest_vault_kinds;
    return Object.keys((_vaultManifest_vault_kinds = vaultManifest(net).vault_kinds) !== null && _vaultManifest_vault_kinds !== void 0 ? _vaultManifest_vault_kinds : {});
}
class KeyValueMemory {
    getItem(k) {
        var _this_d_k;
        return (_this_d_k = this.d[k]) !== null && _this_d_k !== void 0 ? _this_d_k : null;
    }
    setItem(k, v) {
        this.d[k] = v;
    }
    constructor(){
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "d", {});
    }
}
const mockKey = (net)=>"peridot:vaultfactory:mock:v1:".concat(net);
function loadMockVaults(store, net) {
    try {
        const raw = store === null || store === void 0 ? void 0 : store.getItem(mockKey(net));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}
function saveMockVault(store, net, v) {
    const next = [
        v,
        ...loadMockVaults(store, net)
    ].slice(0, 50);
    try {
        store === null || store === void 0 ? void 0 : store.setItem(mockKey(net), JSON.stringify(next));
    } catch (e) {}
    return next;
}
function randomSalt() {
    const bytes = new Uint8Array(32);
    var _globalThis_crypto;
    ((_globalThis_crypto = globalThis.crypto) !== null && _globalThis_crypto !== void 0 ? _globalThis_crypto : (()=>{
        throw new Error('Secure randomness is unavailable in this browser.');
    })()).getRandomValues(bytes);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$buffer$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Buffer"].from(bytes);
}
async function createVault(kind, values, ctx, signer, onProgress) {
    if (kind.status !== 'live') throw new Error("".concat(kind.name, " is not available yet."));
    const init = kind.encode ? kind.encode(values, ctx) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["encodeFields"])(kind, values, ctx);
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) return createMock(kind, values, ctx, onProgress);
    const factory = vaultFactoryId();
    if (!factory) throw new Error("The vault factory is not deployed on ".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, " yet."));
    if (!deployedKinds().includes(kind.id)) throw new Error("".concat(kind.name, " is not registered with the vault factory on ").concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, " yet."));
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["submitContract"])({
        contractId: factory,
        method: 'create_vault',
        signer,
        onProgress,
        args: [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scAddress"])(signer.address),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scSymbol"])(kind.id),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nativeToScVal"])(randomSalt(), {
                type: 'bytes'
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].ScVal.scvVec(init)
        ]
    });
    return {
        address: String(res.value),
        hash: res.hash,
        ledger: res.ledger,
        demo: false
    };
}
async function createMock(kind, values, ctx, onProgress) {
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nextTxId"])();
    const step = (p)=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["emitTx"])({
            id,
            method: 'demo_create_vault',
            contractId: 'demo-vault-factory',
            ...p
        });
        onProgress === null || onProgress === void 0 ? void 0 : onProgress(p);
    };
    step({
        status: 'simulating',
        message: 'Checking the configuration (demo).'
    });
    await new Promise((r)=>setTimeout(r, 250));
    const hash = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (b)=>b.toString(16).padStart(2, '0')).join('');
    const address = 'C' + Array.from(globalThis.crypto.getRandomValues(new Uint8Array(55)), (b)=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32]).join('');
    let store = null;
    try {
        store = window.localStorage;
    } catch (e) {
        store = null;
    }
    saveMockVault(store, ctx.net, {
        address,
        kind: kind.id,
        owner: ctx.owner,
        ledger: 0,
        demo: true,
        txHash: hash,
        createdAt: Date.now(),
        values
    });
    step({
        status: 'success',
        hash,
        message: 'Demo vault saved. No onchain transaction.'
    });
    return {
        address,
        hash,
        ledger: 0,
        demo: true
    };
}
async function listMyVaults(owner) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
        let store = null;
        try {
            store = window.localStorage;
        } catch (e) {
            store = null;
        }
        return loadMockVaults(store, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name).filter((v)=>v.owner === owner);
    }
    const factory = vaultFactoryId();
    if (!factory) return [];
    const addrs = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(factory, 'vaults_of', [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scAddress"])(owner)
    ]);
    const out = await Promise.all(addrs.map(async (address)=>{
        const [kind, vowner, ledger] = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readContract"])(factory, 'get_vault', [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$factory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scAddress"])(address)
        ]);
        return {
            address,
            kind,
            owner: vowner,
            ledger
        };
    }));
    return out.reverse();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/vaults/LadderPreview.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StrategyPreview",
    ()=>StrategyPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
'use client';
;
function StrategyPreview(param) {
    let { model } = param;
    if (model.type === 'rows') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "preview",
            "aria-label": model.title,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                    className: "preview-title",
                    children: model.title
                }, void 0, false, {
                    fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                    lineNumber: 8,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                    className: "preview-rows",
                    children: model.rows.map((param)=>{
                        let [k, v] = param;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                    children: k
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                                    lineNumber: 9,
                                    columnNumber: 77
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                    children: v
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                                    lineNumber: 9,
                                    columnNumber: 89
                                }, this)
                            ]
                        }, k, true, {
                            fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                            lineNumber: 9,
                            columnNumber: 64
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                    lineNumber: 9,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/vaults/LadderPreview.tsx",
            lineNumber: 7,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LadderChart, {
        model: model
    }, void 0, false, {
        fileName: "[project]/src/components/vaults/LadderPreview.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
_c = StrategyPreview;
function LadderChart(param) {
    let { model } = param;
    const { rungs } = model;
    const lo = Math.min(...rungs.map((r)=>r.lowerPct), 0), hi = Math.max(...rungs.map((r)=>r.upperPct), 0);
    const span = Math.max(hi - lo, 0.01), W = 100;
    const x = (pct)=>(pct - lo) / span * W;
    const maxW = Math.max(...rungs.map((r)=>r.weightPct), 1);
    const rowH = 22, gap = 6, top = 6, height = top + rungs.length * (rowH + gap) + 18;
    const spot = x(0);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("figure", {
        className: "preview ladder",
        "aria-label": model.title,
        "data-testid": "ladder-preview",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "preview-title",
                children: model.title
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                lineNumber: 24,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                viewBox: "0 0 ".concat(W, " ").concat(height),
                preserveAspectRatio: "none",
                role: "img",
                "aria-label": model.caption,
                style: {
                    width: '100%',
                    height: Math.max(120, height * 1.6)
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                        x1: spot,
                        x2: spot,
                        y1: 0,
                        y2: height - 14,
                        stroke: "var(--warn)",
                        strokeWidth: 0.5,
                        strokeDasharray: "1.5 1.5",
                        vectorEffect: "non-scaling-stroke"
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                        lineNumber: 26,
                        columnNumber: 7
                    }, this),
                    rungs.map((r, i)=>{
                        const y = top + i * (rowH + gap);
                        const opacity = 0.35 + 0.65 * (r.weightPct / maxW);
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("rect", {
                                x: x(r.lowerPct),
                                y: y,
                                width: Math.max(x(r.upperPct) - x(r.lowerPct), 0.6),
                                height: rowH,
                                rx: 1.2,
                                fill: "var(--accent)",
                                opacity: opacity
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                                lineNumber: 31,
                                columnNumber: 11
                            }, this)
                        }, r.index, false, {
                            fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                            lineNumber: 30,
                            columnNumber: 16
                        }, this);
                    }),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                        x: spot,
                        y: height - 3,
                        fontSize: 4,
                        textAnchor: "middle",
                        fill: "var(--text-2)",
                        children: "price"
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                        lineNumber: 34,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                lineNumber: 25,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "ladder-legend",
                "aria-label": "Rung weights",
                children: rungs.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "Rung ",
                                    r.index + 1
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                                lineNumber: 36,
                                columnNumber: 95
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    r.lowerPct.toFixed(1),
                                    "% to ",
                                    r.upperPct >= 0 ? '+' : '',
                                    r.upperPct.toFixed(1),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                                lineNumber: 36,
                                columnNumber: 126
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: [
                                    r.weightPct.toFixed(r.weightPct % 1 ? 1 : 0),
                                    "%"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                                lineNumber: 36,
                                columnNumber: 219
                            }, this)
                        ]
                    }, r.index, true, {
                        fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                        lineNumber: 36,
                        columnNumber: 77
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                lineNumber: 36,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("figcaption", {
                className: "subtle",
                children: model.caption
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/LadderPreview.tsx",
                lineNumber: 37,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/vaults/LadderPreview.tsx",
        lineNumber: 23,
        columnNumber: 10
    }, this);
}
_c1 = LadderChart;
var _c, _c1;
__turbopack_context__.k.register(_c, "StrategyPreview");
__turbopack_context__.k.register(_c1, "LadderChart");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/vaults/CreateVault.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CreateVault",
    ()=>CreateVault
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.js [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/wallet.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$humanize$2d$tx$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui/humanize-tx-error.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/primitives.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Address.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/schema.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$aquarius$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/aquarius.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$factory$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/factory-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/aquarius-pools.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$LadderPreview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/vaults/LadderPreview.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
;
;
;
;
function CreateVault(param) {
    let { pools, preset, onCreated } = param;
    _s();
    const wallet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWallet"])();
    var _wallet_address;
    const owner = (_wallet_address = wallet.address) !== null && _wallet_address !== void 0 ? _wallet_address : '';
    const [kindId, setKindId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["VAULT_KINDS"][0].id);
    var _VAULT_KINDS_find;
    const kind = (_VAULT_KINDS_find = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["VAULT_KINDS"].find((k)=>k.id === kindId)) !== null && _VAULT_KINDS_find !== void 0 ? _VAULT_KINDS_find : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["VAULT_KINDS"][0];
    const placeholderOwner = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
    const baseCtx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[baseCtx]": ()=>({
                owner: owner || placeholderOwner,
                net: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name,
                decimals: 7
            })
    }["CreateVault.useMemo[baseCtx]"], [
        owner
    ]);
    const [values, setValues] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "CreateVault.useState": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultValues"])(kind, baseCtx)
    }["CreateVault.useState"]);
    const [touched, setTouched] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({});
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Reset the form when the kind changes; keep the connected wallet as owner/keeper default.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateVault.useEffect": ()=>{
            setValues((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["defaultValues"])(kind, baseCtx));
            setTouched({});
            setResult(null);
            setError('');
        }
    }["CreateVault.useEffect"], [
        kind,
        baseCtx
    ]);
    // Prefill from the pool table.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CreateVault.useEffect": ()=>{
            if (!preset || kind.id !== 'aquarius') return;
            var _preset_tokens_find;
            const under = (_preset_tokens_find = preset.tokens.find({
                "CreateVault.useEffect": (t)=>t.symbol === 'USDC' || t.symbol === 'USDT'
            }["CreateVault.useEffect"])) !== null && _preset_tokens_find !== void 0 ? _preset_tokens_find : preset.tokens[0];
            setValues({
                "CreateVault.useEffect": (v)=>({
                        ...v,
                        pool: preset.address,
                        underlying: under.address
                    })
            }["CreateVault.useEffect"]);
        }
    }["CreateVault.useEffect"], [
        preset,
        kind.id
    ]);
    const selectedPool = pools.find((p)=>p.address === values.pool);
    const symbols = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[symbols]": ()=>{
            var _selectedPool_tokens;
            return Object.fromEntries(((_selectedPool_tokens = selectedPool === null || selectedPool === void 0 ? void 0 : selectedPool.tokens) !== null && _selectedPool_tokens !== void 0 ? _selectedPool_tokens : []).map({
                "CreateVault.useMemo[symbols]": (t)=>[
                        t.address,
                        t.symbol
                    ]
            }["CreateVault.useMemo[symbols]"]));
        }
    }["CreateVault.useMemo[symbols]"], [
        selectedPool
    ]);
    const ctx = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[ctx]": ()=>{
            var _selectedPool_feeBps;
            return {
                ...baseCtx,
                facts: {
                    feeBps: (_selectedPool_feeBps = selectedPool === null || selectedPool === void 0 ? void 0 : selectedPool.feeBps) !== null && _selectedPool_feeBps !== void 0 ? _selectedPool_feeBps : null,
                    tickSpacing: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$aquarius$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["tickSpacingForFee"])(selectedPool === null || selectedPool === void 0 ? void 0 : selectedPool.feeBps),
                    symbols
                }
            };
        }
    }["CreateVault.useMemo[ctx]"], [
        baseCtx,
        selectedPool,
        symbols
    ]);
    const formValues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[formValues]": ()=>({
                ...values,
                owner: ctx.owner,
                ...values.keeper ? {} : {
                    keeper: ctx.owner
                }
            })
    }["CreateVault.useMemo[formValues]"], [
        values,
        ctx.owner
    ]);
    const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[validation]": ()=>{
            const v = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateKind"])(kind, formValues, ctx);
            if (kind.id === 'aquarius') {
                if (selectedPool && selectedPool.type !== 'concentrated') v.errors.pool = 'Only concentrated-liquidity pools can have a ladder vault.';
                if (selectedPool && formValues.underlying && !selectedPool.tokens.some({
                    "CreateVault.useMemo[validation]": (t)=>t.address === formValues.underlying
                }["CreateVault.useMemo[validation]"])) v.errors.underlying = 'The deposit token must be one of the pool\'s two tokens.';
            }
            return v;
        }
    }["CreateVault.useMemo[validation]"], [
        kind,
        formValues,
        ctx,
        selectedPool
    ]);
    const preview = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[preview]": ()=>kind.preview ? kind.preview(formValues, ctx) : null
    }["CreateVault.useMemo[preview]"], [
        kind,
        formValues,
        ctx
    ]);
    const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[summary]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isValid"])(validation) && kind.summary ? kind.summary(formValues, ctx) : []
    }["CreateVault.useMemo[summary]"], [
        validation,
        kind,
        formValues,
        ctx
    ]);
    const groups = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "CreateVault.useMemo[groups]": ()=>{
            const out = [];
            for (const f of kind.fields){
                const g = out.find({
                    "CreateVault.useMemo[groups].g": (param)=>{
                        let [n] = param;
                        return n === f.group;
                    }
                }["CreateVault.useMemo[groups].g"]);
                if (g) g[1].push(f);
                else out.push([
                    f.group,
                    [
                        f
                    ]
                ]);
            }
            return out;
        }
    }["CreateVault.useMemo[groups]"], [
        kind
    ]);
    const factoryReady = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks || !!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$factory$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["vaultFactoryId"])() && (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$factory$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deployedKinds"])().includes(kind.id);
    const canSubmit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$schema$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isValid"])(validation) && !busy && (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks || !!wallet.address && factoryReady && !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].readOnly);
    const blocker = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? '' : !wallet.address ? 'Connect a wallet to create a vault.' : !factoryReady ? "The vault factory (".concat(kind.name, ") is not deployed on ").concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, " yet.") : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].readOnly ? 'This preview is read only.' : '';
    async function submit() {
        setError('');
        setResult(null);
        setBusy(true);
        try {
            const signer = {
                address: ctx.owner,
                signTransaction: wallet.signTransaction
            };
            const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$factory$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createVault"])(kind, formValues, ctx, signer);
            setResult(r);
            onCreated();
        } catch (e) {
            setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$humanize$2d$tx$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["humanizeTxError"])(e));
        } finally{
            setBusy(false);
        }
    }
    const set = (key, v)=>{
        setValues((s)=>({
                ...s,
                [key]: v
            }));
        setTouched((t)=>({
                ...t,
                [key]: true
            }));
    };
    const suggestions = (f)=>{
        if (f.suggest === 'pools') return pools.filter((p)=>p.type === 'concentrated').map((p)=>({
                value: p.address,
                label: "".concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pairLabel"])(p), " ").concat(p.feeBps !== null ? (p.feeBps / 100).toFixed(2) + '%' : '').trim()
            }));
        var _selectedPool_tokens;
        if (f.suggest === 'pool-tokens') return ((_selectedPool_tokens = selectedPool === null || selectedPool === void 0 ? void 0 : selectedPool.tokens) !== null && _selectedPool_tokens !== void 0 ? _selectedPool_tokens : []).map((t)=>({
                value: t.address,
                label: t.symbol
            }));
        if (f.suggest === 'owner' && owner) return [
            {
                value: owner,
                label: 'Connected wallet'
            }
        ];
        return [];
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "card vault-create",
        id: "create-vault",
        "aria-labelledby": "create-h",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "card-header",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            id: "create-h",
                            children: "Create a vault"
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                            lineNumber: 82,
                            columnNumber: 39
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "Pick a strategy, tune it, and the factory deploys your own vault contract. You own its settings; nobody can take depositors' funds."
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                            lineNumber: 82,
                            columnNumber: 76
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/vaults/CreateVault.tsx",
                    lineNumber: 82,
                    columnNumber: 34
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 82,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "kind-picker",
                role: "radiogroup",
                "aria-label": "Vault strategy",
                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["VAULT_KINDS"].map((k)=>{
                    const live = k.status === 'live';
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        role: "radio",
                        "aria-checked": k.id === kindId,
                        "aria-disabled": !live,
                        disabled: !live,
                        "data-kind": k.id,
                        className: "kind-card".concat(k.id === kindId ? ' selected' : ''),
                        onClick: ()=>setKindId(k.id),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "row between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: k.name
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 88,
                                        columnNumber: 41
                                    }, this),
                                    live ? k.id === kindId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                        size: 14,
                                        "aria-hidden": true
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 88,
                                        columnNumber: 93
                                    }, this) : null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"],
                                        children: "Soon"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 88,
                                        columnNumber: 135
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 88,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "subtle",
                                children: k.tagline
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 89,
                                columnNumber: 11
                            }, this)
                        ]
                    }, k.id, true, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 87,
                        columnNumber: 16
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 84,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "muted",
                style: {
                    margin: 0,
                    fontSize: 13
                },
                children: kind.description
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 93,
                columnNumber: 5
            }, this),
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                tone: "warn",
                role: "note",
                title: "Demo mode",
                children: "Vaults you create here are saved in this browser only. No wallet signature, no transaction."
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 95,
                columnNumber: 26
            }, this),
            !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks && !factoryReady && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                tone: "warn",
                role: "note",
                title: "Not deployed on this network",
                children: [
                    "The vault factory or this strategy is not registered on ",
                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name,
                    " yet. You can fill in the form and see the preview, but creation is disabled."
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 96,
                columnNumber: 44
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                className: "stack",
                onSubmit: (e)=>{
                    e.preventDefault();
                    if (canSubmit) void submit();
                },
                noValidate: true,
                children: [
                    groups.map((param)=>{
                        let [group, fields] = param;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
                            className: "vault-group",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                                    children: group
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                    lineNumber: 100,
                                    columnNumber: 9
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "field-grid",
                                    children: fields.map((f)=>{
                                        var _formValues_f_key, _symbols_formValues_underlying;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(FieldControl, {
                                            f: f,
                                            value: (_formValues_f_key = formValues[f.key]) !== null && _formValues_f_key !== void 0 ? _formValues_f_key : '',
                                            error: touched[f.key] || formValues[f.key] ? validation.errors[f.key] : undefined,
                                            suggestions: suggestions(f),
                                            disabled: busy || !!f.locked,
                                            onChange: (v)=>set(f.key, v),
                                            unit: f.unit === 'tokens' ? (_symbols_formValues_underlying = symbols[formValues.underlying]) !== null && _symbols_formValues_underlying !== void 0 ? _symbols_formValues_underlying : 'tokens' : f.unit
                                        }, f.key, false, {
                                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                            lineNumber: 102,
                                            columnNumber: 28
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                    lineNumber: 101,
                                    columnNumber: 9
                                }, this)
                            ]
                        }, group, true, {
                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                            lineNumber: 99,
                            columnNumber: 40
                        }, this);
                    }),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "vault-preview-grid",
                        children: [
                            preview ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$LadderPreview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrategyPreview"], {
                                model: preview
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 107,
                                columnNumber: 20
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "subtle",
                                children: "Fill in the ladder fields to see the preview."
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 107,
                                columnNumber: 58
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "stack-sm",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "preview-title",
                                        children: "Summary"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 109,
                                        columnNumber: 11
                                    }, this),
                                    summary.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "summary-list",
                                        children: summary.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                children: s
                                            }, s, false, {
                                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                                lineNumber: 110,
                                                columnNumber: 76
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 110,
                                        columnNumber: 29
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "subtle",
                                        children: "Fix the highlighted fields to see the summary."
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 110,
                                        columnNumber: 106
                                    }, this),
                                    validation.warnings.map((w)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                                            tone: "warn",
                                            role: "note",
                                            children: w
                                        }, w, false, {
                                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                            lineNumber: 111,
                                            columnNumber: 41
                                        }, this))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 108,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 106,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                        className: "risk-box",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                children: "Risks of this strategy"
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 115,
                                columnNumber: 37
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                children: kind.risks.map((r)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: r
                                    }, r, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 115,
                                        columnNumber: 103
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 115,
                                columnNumber: 78
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 115,
                        columnNumber: 7
                    }, this),
                    Object.keys(validation.errors).length > 0 && Object.keys(touched).length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                        tone: "danger",
                        role: "alert",
                        title: "Check the form",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                            style: {
                                margin: 0,
                                paddingLeft: 18
                            },
                            children: Object.values(validation.errors).map((e)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: e
                                }, e, false, {
                                    fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                    lineNumber: 117,
                                    columnNumber: 232
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                            lineNumber: 117,
                            columnNumber: 146
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 117,
                        columnNumber: 88
                    }, this),
                    error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                        tone: "danger",
                        role: "alert",
                        children: error
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 118,
                        columnNumber: 17
                    }, this),
                    result && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                        tone: "success",
                        role: "status",
                        title: result.demo ? 'Demo vault saved' : 'Vault created',
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: result.demo ? 'Saved in "My vaults" below. Nothing was sent on chain.' : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    "Vault ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"], {
                                        value: result.address,
                                        label: "vault address",
                                        head: 6,
                                        tail: 6
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 120,
                                        columnNumber: 94
                                    }, this),
                                    " is live. ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["transactionUrl"])(result.hash),
                                        target: "_blank",
                                        rel: "noreferrer",
                                        children: "View transaction"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                        lineNumber: 120,
                                        columnNumber: 178
                                    }, this)
                                ]
                            }, void 0, true)
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/CreateVault.tsx",
                            lineNumber: 120,
                            columnNumber: 9
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 119,
                        columnNumber: 18
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "submit",
                                className: "button",
                                disabled: !canSubmit,
                                children: busy ? 'Creating vault...' : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'Create demo vault' : 'Create vault'
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 123,
                                columnNumber: 9
                            }, this),
                            blocker && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "subtle",
                                style: {
                                    fontSize: 12
                                },
                                children: blocker
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 124,
                                columnNumber: 21
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 122,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 98,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/vaults/CreateVault.tsx",
        lineNumber: 81,
        columnNumber: 10
    }, this);
}
_s(CreateVault, "4xYkErxazu3AoQ/7h60GDALCGYc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWallet"]
    ];
});
_c = CreateVault;
function FieldControl(param) {
    let { f, value, error, suggestions, disabled, onChange, unit } = param;
    var _f_options_find;
    const id = "vf-".concat(f.key), hintId = "".concat(id, "-hint"), listId = "".concat(id, "-list");
    const common = {
        id,
        'aria-describedby': hintId,
        'aria-invalid': error ? true : undefined,
        disabled
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "field".concat(error ? ' invalid' : ''),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                htmlFor: id,
                children: [
                    f.label,
                    unit && f.input !== 'select' && f.input !== 'address' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "field-unit",
                        children: [
                            " (",
                            unit,
                            ")"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 134,
                        columnNumber: 91
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 134,
                columnNumber: 5
            }, this),
            f.input === 'select' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                ...common,
                value: value,
                onChange: (e)=>onChange(e.target.value),
                children: f.options.map((o)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: o.value,
                        children: o.label
                    }, o.value, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 136,
                        columnNumber: 105
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 136,
                columnNumber: 9
            }, this) : f.input === 'toggle' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                ...common,
                type: "checkbox",
                checked: value === 'true',
                onChange: (e)=>onChange(String(e.target.checked))
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 138,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        ...common,
                        type: "text",
                        inputMode: f.input === 'address' || f.input === 'text' ? 'text' : 'decimal',
                        autoComplete: "off",
                        spellCheck: false,
                        value: value,
                        list: suggestions.length ? listId : undefined,
                        onChange: (e)=>onChange(e.target.value.trim())
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 140,
                        columnNumber: 11
                    }, this),
                    suggestions.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("datalist", {
                        id: listId,
                        children: suggestions.map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: s.value,
                                children: s.label
                            }, s.value, false, {
                                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                                lineNumber: 141,
                                columnNumber: 82
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 141,
                        columnNumber: 38
                    }, this)
                ]
            }, void 0, true),
            f.input === 'select' && ((_f_options_find = f.options.find((o)=>o.value === value)) === null || _f_options_find === void 0 ? void 0 : _f_options_find.hint) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "field-hint",
                children: f.options.find((o)=>o.value === value).hint
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 143,
                columnNumber: 79
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "field-hint",
                id: hintId,
                children: error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "field-error",
                    role: "alert",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/src/components/vaults/CreateVault.tsx",
                    lineNumber: 144,
                    columnNumber: 55
                }, this) : f.help
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 144,
                columnNumber: 5
            }, this),
            f.suggest && suggestions.length > 0 && f.input === 'address' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "chip-row",
                children: suggestions.slice(0, 6).map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        className: "chip",
                        disabled: disabled,
                        onClick: ()=>onChange(s.value),
                        children: s.label
                    }, s.value, false, {
                        fileName: "[project]/src/components/vaults/CreateVault.tsx",
                        lineNumber: 145,
                        columnNumber: 131
                    }, this))
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/CreateVault.tsx",
                lineNumber: 145,
                columnNumber: 70
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/vaults/CreateVault.tsx",
        lineNumber: 133,
        columnNumber: 10
    }, this);
}
_c1 = FieldControl;
var _c, _c1;
__turbopack_context__.k.register(_c, "CreateVault");
__turbopack_context__.k.register(_c1, "FieldControl");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/vaults/MyVaults.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MyVaults",
    ()=>MyVaults
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$vault$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Vault$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/vault.js [app-client] (ecmascript) <export default as Vault>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/wallet.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/primitives.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Address.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/src/lib/vaults/kinds/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$factory$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/factory-client.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
function MyVaults(param) {
    let { refreshKey } = param;
    _s();
    const wallet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWallet"])();
    var _wallet_address;
    const owner = (_wallet_address = wallet.address) !== null && _wallet_address !== void 0 ? _wallet_address : '';
    const [items, setItems] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const load = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MyVaults.useCallback[load]": async ()=>{
            if (!owner) {
                setItems([]);
                return;
            }
            try {
                setError('');
                setItems(await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$factory$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["listMyVaults"])(owner));
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Vaults could not be loaded.');
                setItems([]);
            }
        }
    }["MyVaults.useCallback[load]"], [
        owner
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MyVaults.useEffect": ()=>{
            void load();
        }
    }["MyVaults.useEffect"], [
        load,
        refreshKey
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "card",
        "aria-labelledby": "mine-h",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "card-header",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            id: "mine-h",
                            children: "My vaults"
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/MyVaults.tsx",
                            lineNumber: 25,
                            columnNumber: 39
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'Demo vaults, saved in this browser only. They are not contracts.' : 'Vaults you created through the vault factory.'
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/MyVaults.tsx",
                            lineNumber: 25,
                            columnNumber: 69
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/vaults/MyVaults.tsx",
                    lineNumber: 25,
                    columnNumber: 34
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 25,
                columnNumber: 5
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                tone: "warn",
                role: "alert",
                children: error
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 26,
                columnNumber: 15
            }, this),
            items === null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                height: 44,
                style: {
                    borderRadius: 10
                }
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 27,
                columnNumber: 23
            }, this) : !owner && !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmptyState"], {
                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$vault$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Vault$3e$__["Vault"],
                title: "Connect a wallet",
                role: "status",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "Connect your wallet to see the vaults you created."
                }, void 0, false, {
                    fileName: "[project]/src/components/vaults/MyVaults.tsx",
                    lineNumber: 28,
                    columnNumber: 103
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 28,
                columnNumber: 39
            }, this) : items.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmptyState"], {
                icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$vault$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Vault$3e$__["Vault"],
                title: "No vaults yet",
                role: "status",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "Create one above and it appears here."
                }, void 0, false, {
                    fileName: "[project]/src/components/vaults/MyVaults.tsx",
                    lineNumber: 29,
                    columnNumber: 91
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 29,
                columnNumber: 30
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "demo-vault-list",
                children: items.map((v)=>{
                    const kind = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$kinds$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["getKind"])(v.kind);
                    var _kind_name, _v_createdAt;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
                        className: "card inset",
                        "data-testid": "my-vault",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "row between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                        children: (_kind_name = kind === null || kind === void 0 ? void 0 : kind.name) !== null && _kind_name !== void 0 ? _kind_name : v.kind
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                        lineNumber: 33,
                                        columnNumber: 40
                                    }, this),
                                    v.demo ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                        tone: "warn",
                                        children: "Demo, not deployed"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                        lineNumber: 33,
                                        columnNumber: 89
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                        tone: "success",
                                        children: "On chain"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                        lineNumber: 33,
                                        columnNumber: 137
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                lineNumber: 33,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "subtle",
                                style: {
                                    margin: '4px 0 0',
                                    fontSize: 12
                                },
                                children: [
                                    v.demo ? "Created ".concat(new Date((_v_createdAt = v.createdAt) !== null && _v_createdAt !== void 0 ? _v_createdAt : 0).toLocaleString()) : "Created at ledger ".concat(v.ledger),
                                    " · vault ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"], {
                                        value: v.address,
                                        label: "vault address",
                                        head: 6,
                                        tail: 6
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                        lineNumber: 34,
                                        columnNumber: 187
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                lineNumber: 34,
                                columnNumber: 11
                            }, this),
                            v.values && (kind === null || kind === void 0 ? void 0 : kind.summary) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "summary-list",
                                style: {
                                    marginTop: 6
                                },
                                children: safeSummary(kind, v)
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                                lineNumber: 35,
                                columnNumber: 41
                            }, this)
                        ]
                    }, v.address, true, {
                        fileName: "[project]/src/components/vaults/MyVaults.tsx",
                        lineNumber: 32,
                        columnNumber: 16
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 30,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/vaults/MyVaults.tsx",
        lineNumber: 24,
        columnNumber: 10
    }, this);
}
_s(MyVaults, "eF48sVfQWzDS4vT+uzbHZaMHNAM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWallet"]
    ];
});
_c = MyVaults;
function safeSummary(kind, v) {
    try {
        return kind.summary(v.values, {
            owner: v.owner,
            net: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name,
            decimals: 7
        }).map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                children: s
            }, s, false, {
                fileName: "[project]/src/components/vaults/MyVaults.tsx",
                lineNumber: 42,
                columnNumber: 102
            }, this));
    } catch (e) {
        return null;
    }
}
var _c;
__turbopack_context__.k.register(_c, "MyVaults");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/vaults/VaultsPage.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>VaultsPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$droplets$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Droplets$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/droplets.js [app-client] (ecmascript) <export default as Droplets>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/primitives.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Address.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$VaultOptionList$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/vaults/VaultOptionList.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$useAquariusPools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/vaults/useAquariusPools.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/vaults/aquarius-pools.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$CreateVault$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/vaults/CreateVault.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$MyVaults$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/vaults/MyVaults.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
;
;
;
const SOURCE_LABEL = {
    chain: 'Aquarius router (on chain)',
    api: 'Aquarius API',
    registry: 'Verified pool list shipped with the app',
    demo: 'Demo data'
};
function VaultsPage() {
    _s();
    const { loading, result, reload } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$useAquariusPools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAquariusPools"])();
    const [filter, setFilter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('all');
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [selected, setSelected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [refresh, setRefresh] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const pools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "VaultsPage.useMemo[pools]": ()=>{
            var _result_pools;
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyPoolFilter"])((_result_pools = result === null || result === void 0 ? void 0 : result.pools) !== null && _result_pools !== void 0 ? _result_pools : [], filter, query);
        }
    }["VaultsPage.useMemo[pools]"], [
        result,
        filter,
        query
    ]);
    var _result_pools;
    const eligibleCount = ((_result_pools = result === null || result === void 0 ? void 0 : result.pools) !== null && _result_pools !== void 0 ? _result_pools : []).filter(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isVaultEligible"]).length;
    const netLabel = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'Demo' : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name === 'mainnet' ? 'Mainnet (read only)' : 'Testnet';
    var _result_pools_length, _result_pools1;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "page",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "page-heading",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        minWidth: 0
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "eyebrow",
                            children: "Vaults"
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                            lineNumber: 31,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                            className: "vault-title",
                            children: [
                                "Where a market earns yield ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                    tone: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name === 'mainnet' && !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'success' : 'info',
                                    children: netLabel
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                    lineNumber: 32,
                                    columnNumber: 64
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                            lineNumber: 32,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "lead",
                            children: "Every yield venue Peridot knows about, and a vault factory: design your own Aquarius ladder vault (or another strategy), tune it, and deploy it from this page. Blend and DeFindex markets are live; XOXNO and Zenex are listed so you can see what is planned."
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                            lineNumber: 33,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                    lineNumber: 30,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                lineNumber: 29,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "card",
                "aria-labelledby": "venues-h",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "card-header",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    id: "venues-h",
                                    children: "Yield venues"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                    lineNumber: 38,
                                    columnNumber: 41
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    children: "Pick one per market when you launch a group. Locked venues cannot be submitted."
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                    lineNumber: 38,
                                    columnNumber: 76
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                            lineNumber: 38,
                            columnNumber: 36
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 38,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$VaultOptionList$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VaultOptionList"], {
                        ariaLabel: "Yield venues"
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 39,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                lineNumber: 37,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "card",
                "aria-labelledby": "pools-h",
                "aria-busy": loading,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "card-header",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                        id: "pools-h",
                                        children: "Aquarius pools with USDC"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 44,
                                        columnNumber: 14
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        children: "Read only. The LP vault needs a concentrated liquidity pool, so only those can get a vault."
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 44,
                                        columnNumber: 60
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 44,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "button secondary sm",
                                onClick: reload,
                                disabled: loading,
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                        size: 14,
                                        "aria-hidden": true,
                                        className: loading ? 'spin' : ''
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 45,
                                        columnNumber: 99
                                    }, this),
                                    " Refresh"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 45,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 43,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "vault-toolbar",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Tabs"], {
                                ariaLabel: "Pool filter",
                                value: filter,
                                onChange: setFilter,
                                items: [
                                    {
                                        value: 'all',
                                        label: "All USDC pools (".concat((_result_pools_length = result === null || result === void 0 ? void 0 : result.pools.length) !== null && _result_pools_length !== void 0 ? _result_pools_length : 0, ")")
                                    },
                                    {
                                        value: 'vault-eligible',
                                        label: "Vault eligible (".concat(eligibleCount, ")")
                                    }
                                ]
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 48,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "row",
                                style: {
                                    gap: 6
                                },
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                        size: 14,
                                        "aria-hidden": true
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 49,
                                        columnNumber: 51
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "sr-only",
                                        children: "Search pools"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 49,
                                        columnNumber: 83
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "search",
                                        "aria-label": "Search pools",
                                        placeholder: "Search pair or address",
                                        value: query,
                                        onChange: (e)=>setQuery(e.target.value)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 49,
                                        columnNumber: 128
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 49,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 47,
                        columnNumber: 7
                    }, this),
                    result && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "vault-source",
                        role: "status",
                        children: [
                            "Source: ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                tone: result.primary === 'demo' ? 'warn' : 'neutral',
                                children: SOURCE_LABEL[result.primary]
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 52,
                                columnNumber: 68
                            }, this),
                            result.primary === 'chain' && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "The API alone hides some live pools, so pools come from the router first."
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 52,
                                columnNumber: 198
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 52,
                        columnNumber: 18
                    }, this),
                    result && result.warnings.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Notice"], {
                        tone: "warn",
                        role: "alert",
                        title: "Some pool sources are unavailable",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                style: {
                                    margin: 0,
                                    paddingLeft: 18
                                },
                                children: result.warnings.map((w)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: w
                                    }, w, false, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 53,
                                        columnNumber: 192
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 53,
                                columnNumber: 123
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "button secondary sm",
                                style: {
                                    marginTop: 8
                                },
                                onClick: reload,
                                children: "Try again"
                            }, void 0, false, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 53,
                                columnNumber: 219
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 53,
                        columnNumber: 48
                    }, this),
                    loading && !result ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "aria-label": "Loading pools",
                        className: "stack-sm",
                        children: [
                            0,
                            1,
                            2,
                            3
                        ].map((i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Skeleton"], {
                                height: 44,
                                style: {
                                    borderRadius: 10
                                }
                            }, i, false, {
                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                lineNumber: 55,
                                columnNumber: 105
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 55,
                        columnNumber: 29
                    }, this) : pools.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EmptyState"], {
                        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$droplets$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Droplets$3e$__["Droplets"],
                        title: "No pools match",
                        role: "status",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: query ? 'Try a different search.' : 'No USDC pools were found for this filter.'
                        }, void 0, false, {
                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                            lineNumber: 56,
                            columnNumber: 97
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 56,
                        columnNumber: 32
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "table-scroll",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                            className: "data-table pool-table",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Pair"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                lineNumber: 58,
                                                columnNumber: 22
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Type"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                lineNumber: 58,
                                                columnNumber: 35
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Fee"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                lineNumber: 58,
                                                columnNumber: 48
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                title: "Approximate: twice the USDC reserve",
                                                children: "TVL (approx.)"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                lineNumber: 58,
                                                columnNumber: 60
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: "Pool"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                lineNumber: 58,
                                                columnNumber: 126
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "sr-only",
                                                    children: "Action"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 58,
                                                    columnNumber: 143
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                lineNumber: 58,
                                                columnNumber: 139
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                        lineNumber: 58,
                                        columnNumber: 18
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                    lineNumber: 58,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                    children: pools.map((pool)=>{
                                        const eligible = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isVaultEligible"])(pool), isSel = (selected === null || selected === void 0 ? void 0 : selected.address) === pool.address;
                                        var _vaultIneligibleReason;
                                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                            className: isSel ? 'selected-row' : undefined,
                                            "data-testid": "pool-row",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    "data-label": "Pair",
                                                    className: "span",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "pool-pair",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "cell-main",
                                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pairLabel"])(pool)
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                                lineNumber: 62,
                                                                columnNumber: 82
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "cell-sub",
                                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isStablePair"])(pool) ? 'Stable pair' : 'Volatile pair'
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                                lineNumber: 62,
                                                                columnNumber: 134
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                        lineNumber: 62,
                                                        columnNumber: 54
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 62,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    "data-label": "Type",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                        tone: eligible ? 'accent' : 'neutral',
                                                        children: pool.type === 'concentrated' ? 'Concentrated' : pool.type === 'stable' ? 'Stable swap' : pool.type === 'constant_product' ? 'Constant product' : 'Unknown'
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                        lineNumber: 63,
                                                        columnNumber: 37
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 63,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    "data-label": "Fee",
                                                    className: "num",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatFee"])(pool.feeBps)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 64,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    "data-label": "TVL (approx.)",
                                                    className: "num",
                                                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatUsd"])(pool.tvlUsd)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 65,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    "data-label": "Pool",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"], {
                                                        value: pool.address,
                                                        label: "".concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pairLabel"])(pool), " pool address"),
                                                        head: 6,
                                                        tail: 6
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                        lineNumber: 66,
                                                        columnNumber: 37
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 66,
                                                    columnNumber: 15
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "actions span",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        type: "button",
                                                        className: "button sm",
                                                        disabled: !eligible,
                                                        title: (_vaultIneligibleReason = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["vaultIneligibleReason"])(pool)) !== null && _vaultIneligibleReason !== void 0 ? _vaultIneligibleReason : undefined,
                                                        "aria-label": "Create a vault for ".concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$vaults$2f$aquarius$2d$pools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["pairLabel"])(pool)),
                                                        onClick: ()=>{
                                                            setSelected(pool);
                                                            setTimeout(()=>{
                                                                var _document_getElementById;
                                                                return (_document_getElementById = document.getElementById('create-vault')) === null || _document_getElementById === void 0 ? void 0 : _document_getElementById.scrollIntoView({
                                                                    behavior: 'smooth',
                                                                    block: 'start'
                                                                });
                                                            }, 50);
                                                        },
                                                        children: eligible ? isSel ? 'Selected' : 'Use in the form below' : 'Not eligible'
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                        lineNumber: 67,
                                                        columnNumber: 44
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                                    lineNumber: 67,
                                                    columnNumber: 15
                                                }, this)
                                            ]
                                        }, pool.address, true, {
                                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                            lineNumber: 61,
                                            columnNumber: 20
                                        }, this);
                                    })
                                }, void 0, false, {
                                    fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                                    lineNumber: 59,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                            lineNumber: 57,
                            columnNumber: 41
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                        lineNumber: 57,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                lineNumber: 42,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$CreateVault$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CreateVault"], {
                pools: (_result_pools1 = result === null || result === void 0 ? void 0 : result.pools) !== null && _result_pools1 !== void 0 ? _result_pools1 : [],
                preset: selected,
                onCreated: ()=>setRefresh((n)=>n + 1)
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                lineNumber: 72,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$MyVaults$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MyVaults"], {
                refreshKey: refresh
            }, void 0, false, {
                fileName: "[project]/src/components/vaults/VaultsPage.tsx",
                lineNumber: 74,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/vaults/VaultsPage.tsx",
        lineNumber: 28,
        columnNumber: 10
    }, this);
}
_s(VaultsPage, "P7lh2C/a6V122Tm8j5mxWoxYpig=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$vaults$2f$useAquariusPools$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAquariusPools"]
    ];
});
_c = VaultsPage;
var _c;
__turbopack_context__.k.register(_c, "VaultsPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_be71e9eb._.js.map