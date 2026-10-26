(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/peridot/deployments/mainnet.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"network\":\"mainnet\",\"core_commit\":\"47858c1a13c2588970395faa2212e7b68bd33060\",\"factory\":\"CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S\",\"margin_factory\":\"CCTFHRHDJM4BH6O2R325L6JXYWVCUDCM2IBO3BLRCE53KDM5JR5YZ6YH\",\"wasm\":{\"receipt_vault\":\"8cc9f7231179bb60585c555b9a207fd397d7622615b87cb3289e1a10b0137de9\",\"controller\":\"dabe8d1cd44d9bf893b5acd799f9269ea5829761522aa31bafe08dbd4106eac5\",\"jump_rate\":\"4052162e583af42f61cd0e25a606180a2036ff158b505355219152ec09a1121a\",\"price_router\":\"e04a63e0cd653c0672fbef06324dec1179b4145ccd0d4a3469d1bf94428e1876\",\"reward_distributor\":\"2e5790ce46581ad46de216e36ad543b8190ba12cc24b1e3fc3b3f1c10ceb4b71\",\"swap_adapter\":\"2640f364c3bb4ddf7b29c58a757a7c675f5f53cbb2ea35e14eb445939edb7f4f\",\"margin\":\"f11f34e7bfe46dae2139acfa7623a511cc9e15e725a0d923224a0b6848ad6e51\",\"blend_adapter\":\"4a5b6d2c5996e2a30b33456c013a91e3a64ca93784044915a989ecf3d3971739\"},\"external\":{\"reflector_external\":\"CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN\",\"reflector_stellar\":\"CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M\",\"usdc\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"xlm\":\"CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA\",\"defindex_vaults\":{\"XLM\":\"CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK\"},\"blend_fee_vault\":\"CCHILGAYU4DQXLWSTOA5BQYZD7QJMWUU5PQLS4Z25FLI2WP6IVV3X337\",\"aquarius_router\":\"CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK\",\"blend_pool\":\"CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD\",\"xlm_usdc_margin_pool\":\"CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV\"},\"demo\":{\"group_id\":1,\"markets\":{\"USDC\":\"CCZHYRBCNKB5F3RPMD4VV747NIV6QFJ4EBZLPWDSQWHNNKYDO62OVIRM\",\"XLM\":\"CCK7R22G3HOZDJXU6DVDEXK4HZ6AS3DHHFCAFOMY22XQEA3DJHRRSNXI\"},\"controller\":\"CCIVCL6B5TNYC5PTJDFXD24AEJ5VQU5XUTZXFFGMIVRWQSSZFZPIPUES\",\"price_router\":\"CBBZ2FPMJDFSGQD64Y6U4IKJ7YXO2RP5T5AQMXRNBYKFXZOTGMFTF3XD\",\"margin_controller\":\"CCWAUBM6C5RRPBFKJK57I56GXRCILOKRVJEOAGEI7ZHKXVSOHEL5JPEY\",\"rewards_group_id\":2,\"rewards_market\":\"CARDJEVXDP5RY3GAKRYSW4T5CKYY7Y4PQTS4CJSVQEBKP4JMHTDFPXNV\",\"reward_distributor\":\"CA4AMJK54MZI2KDU5KJFPF5SD4KULJETIITPVVQH5WTEH2WH6IKOSYUF\",\"rewards_controller\":\"CADHYBWKFNDE3LKNWCRD7F6FNHTNQAR4W3AT2G3TROO7V6RZ2VMUKZSZ\",\"rewards_note\":\"group 2 holds rewards; group 1 stays open for add_market\",\"blend_group_id\":3,\"blend_market\":\"CCUQUYBW3LJXPYB5U5QIDBDWPMKYVBPCIHQZSSXOSAV2SIXOBDNHSUDM\",\"blend_adapter\":\"CDLLNAM63H5BVYH4BCNIWY6AULTDO6H455M4NF3HIYUW4XBXW6TPOPIX\"}}"));}),
"[project]/src/lib/peridot/deployments/testnet.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v(JSON.parse("{\"network\":\"testnet\",\"status\":\"Awaiting Lead A deployment manifest\",\"vault_factory\":\"CAORI4VMNA655LG3JD4B253YW74VIJ6L4ZXCSFL6R54S75GR746X2JUE\",\"vault_kinds\":{\"aquarius\":\"804bb4e29cc13c7adf7ef6da31098bf569d2b468cdeb6bf50b722ae9aab482d6\"}}"));}),
"[project]/src/lib/peridot/network.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getDeployments",
    ()=>getDeployments,
    "isMarginAvailable",
    ()=>isMarginAvailable,
    "network",
    ()=>network,
    "transactionUrl",
    ()=>transactionUrl
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/network.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$mainnet$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/deployments/mainnet.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$testnet$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/deployments/testnet.json (json)");
;
;
;
const selected = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_NETWORK || 'mainnet';
if (selected !== 'mainnet' && selected !== 'testnet') throw new Error('NEXT_PUBLIC_NETWORK must be mainnet or testnet.');
const network = {
    name: selected,
    passphrase: selected === 'mainnet' ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Networks"].PUBLIC : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Networks"].TESTNET,
    rpcUrl: selected === 'mainnet' ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_MAINNET_RPC_URL || '' : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org',
    fallbackRpcUrl: selected === 'mainnet' ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_MAINNET_FALLBACK_RPC_URL || 'https://rpc.lightsail.network/' : '',
    useMocks: ("TURBOPACK compile-time value", "true") === 'true',
    readOnly: ("TURBOPACK compile-time value", "false") === 'true',
    explorerUrl: "https://stellar.expert/explorer/".concat(selected === 'mainnet' ? 'public' : 'testnet')
};
function getDeployments() {
    const raw = selected === 'mainnet' ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$mainnet$2e$json__$28$json$29$__["default"] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$deployments$2f$testnet$2e$json__$28$json$29$__["default"];
    if (raw.network !== selected || !raw.factory || !__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(raw.factory)) {
        throw new Error("The ".concat(selected, " factory has not been configured. A verified deployment manifest is required."));
    }
    return raw;
}
function transactionUrl(hash) {
    return "".concat(network.explorerUrl, "/tx/").concat(encodeURIComponent(hash));
}
function isMarginAvailable() {
    if (network.useMocks) return true;
    try {
        var _d_wasm, _d_wasm1;
        const d = getDeployments();
        return !!d.margin_factory && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidContract(d.margin_factory) && !!((_d_wasm = d.wasm) === null || _d_wasm === void 0 ? void 0 : _d_wasm.margin) && !!((_d_wasm1 = d.wasm) === null || _d_wasm1 === void 0 ? void 0 : _d_wasm1.swap_adapter);
    } catch (e) {
        return false;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/wallet/request.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Distinguishes failures the user can fix without repeating the whole transaction preparation. */ __turbopack_context__.s([
    "POPUP_BLOCKED_MESSAGE",
    ()=>POPUP_BLOCKED_MESSAGE,
    "POPUP_CLOSED_MESSAGE",
    ()=>POPUP_CLOSED_MESSAGE,
    "WalletRequest",
    ()=>WalletRequest,
    "WalletWindowError",
    ()=>WalletWindowError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
;
class WalletWindowError extends Error {
    constructor(kind, message){
        super(message), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "kind", void 0), this.kind = kind;
        this.name = 'WalletWindowError';
    }
}
const POPUP_BLOCKED_MESSAGE = 'Your browser blocked the Albedo window. Allow pop-ups for this site (the icon at the right of the address bar, or browser settings), then try again.';
const POPUP_CLOSED_MESSAGE = 'The Albedo window was closed before it responded. Nothing was signed. Open it again to continue.';
/** Wait before reporting a closed window: Albedo closes its own window right after it replies. */ const CLOSED_GRACE_MS = 1000, CLOSED_POLL_MS = 500;
class WalletRequest {
    get isBusy() {
        return this.cancelPending !== undefined;
    }
    run(start) {
        let timeoutMs = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 60_000, options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
        if (this.cancelPending) return Promise.reject(new Error('Another wallet request is already open. Cancel it before trying again.'));
        return new Promise((resolve, reject)=>{
            var _this = this;
            let settled = false, win = {
                popup: null
            }, poll, grace;
            const closePopup = ()=>{
                try {
                    if (win.popup && !win.popup.closed) win.popup.close();
                } catch (e) {}
            };
            const finish = function(error, value) {
                let closeWindow = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                clearInterval(poll);
                clearTimeout(grace);
                _this.cancelPending = undefined;
                if (closeWindow) closePopup();
                if (error) reject(error);
                else resolve(value);
            };
            const timer = setTimeout(()=>finish(new Error('The wallet did not respond. Close its old window and try again. If no window appeared, check your browser popup settings.'), undefined, true), timeoutMs);
            this.cancelPending = ()=>finish(new Error('Wallet request cancelled. Close its window before trying again.'), undefined, true);
            // Execute immediately, not in a Promise.then: preserve the browser user gesture.
            const watch = options.watchPopup && "object" !== 'undefined';
            const original = watch ? window.open : undefined;
            let opened = false;
            if (watch) window.open = function() {
                for(var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++){
                    args[_key] = arguments[_key];
                }
                const handle = original.apply(window, args);
                opened = true;
                win.popup = handle;
                return handle;
            };
            try {
                start().then((value)=>finish(undefined, value), (error)=>finish(error));
            } catch (error) {
                finish(error);
            } finally{
                if (watch && window.open !== original) window.open = original;
            }
            // window.open ran (or not) synchronously inside start(). Freighter and iframe flows never open one, so "not called" is not "blocked".
            if (watch && opened && !settled) {
                if (!win.popup) {
                    finish(new WalletWindowError('blocked', POPUP_BLOCKED_MESSAGE));
                    return;
                }
                try {
                    win.popup.focus();
                } catch (e) {}
                poll = setInterval(()=>{
                    let closed = false;
                    try {
                        var _win_popup;
                        closed = !!((_win_popup = win.popup) === null || _win_popup === void 0 ? void 0 : _win_popup.closed);
                    } catch (e) {
                        closed = false;
                    }
                    if (closed && !grace) grace = setTimeout(()=>finish(new WalletWindowError('closed', POPUP_CLOSED_MESSAGE)), CLOSED_GRACE_MS);
                }, CLOSED_POLL_MS);
            }
        });
    }
    cancel() {
        var _this_cancelPending, _this;
        (_this_cancelPending = (_this = this).cancelPending) === null || _this_cancelPending === void 0 ? void 0 : _this_cancelPending.call(_this);
    }
    constructor(){
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "cancelPending", void 0);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/wallet/kit.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CONNECT_TIMEOUT_MS",
    ()=>CONNECT_TIMEOUT_MS,
    "EXPIRY_GUARD_MS",
    ()=>EXPIRY_GUARD_MS,
    "QUICK_TIMEOUT_MS",
    ()=>QUICK_TIMEOUT_MS,
    "SIGN_TIMEOUT_MS",
    ()=>SIGN_TIMEOUT_MS,
    "cancelKitRequest",
    ()=>cancelKitRequest,
    "connectKit",
    ()=>connectKit,
    "describeWalletError",
    ()=>describeWalletError,
    "disconnectKit",
    ()=>disconnectKit,
    "getKitNetwork",
    ()=>getKitNetwork,
    "initializeKit",
    ()=>initializeKit,
    "isKitReady",
    ()=>isKitReady,
    "signKitTransaction",
    ()=>signKitTransaction,
    "signingWindowMs",
    ()=>signingWindowMs,
    "validateWalletSignature",
    ()=>validateWalletSignature
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$keypair$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/keypair.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/network.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/strkey.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/transaction.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/transaction_builder.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$request$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/wallet/request.ts [app-client] (ecmascript)");
;
;
let kit;
let loading;
let configuredPassphrase;
let selected = 'albedo';
let connectedAddress = null;
let generation = 0;
const request = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$request$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WalletRequest"]();
const CONNECT_TIMEOUT_MS = 300_000, SIGN_TIMEOUT_MS = 300_000, QUICK_TIMEOUT_MS = 30_000, EXPIRY_GUARD_MS = 10_000;
function describeWalletError(error, wallet) {
    if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$request$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WalletWindowError"]) return error;
    const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '';
    const code = error && typeof error === 'object' && 'code' in error ? Number(error.code) : undefined;
    if (error instanceof Error) return error;
    if (/freighter is not connected|not installed|extension.*not/i.test(raw)) return new Error('Freighter was not detected. Install and unlock the Freighter extension, allow it on this site, reload this page, or choose Albedo.');
    if (/reject|declin|denied|cancel|closed the modal/i.test(raw) || code === -4) return new Error("You declined the request in ".concat(wallet === 'albedo' ? 'Albedo' : 'Freighter', ". Nothing was signed. Try again when ready."));
    return new Error(raw || 'The wallet request failed. Try again.');
}
function signingWindowMs(tx) {
    let now = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Date.now();
    var _tx_timeBounds;
    const max = Number((_tx_timeBounds = tx.timeBounds) === null || _tx_timeBounds === void 0 ? void 0 : _tx_timeBounds.maxTime);
    if (!Number.isFinite(max) || max <= 0) return SIGN_TIMEOUT_MS;
    return Math.min(SIGN_TIMEOUT_MS, max * 1000 - now - EXPIRY_GUARD_MS);
}
function isKitReady(passphrase) {
    return !!kit && configuredPassphrase === passphrase;
}
function validateNetwork(passphrase) {
    if (passphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Networks"].PUBLIC && passphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Networks"].TESTNET) throw new Error('This app supports Stellar mainnet and testnet only.');
}
async function initializeKit(passphrase) {
    validateNetwork(passphrase);
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    if (!loading) loading = (async ()=>{
        const [{ StellarWalletsKit: loaded }, { AlbedoModule, ALBEDO_ID }, { FreighterModule }] = await Promise.all([
            __turbopack_context__.A("[project]/node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/mod.js [app-client] (ecmascript, async loader)"),
            __turbopack_context__.A("[project]/node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/albedo.module.js [app-client] (ecmascript, async loader)"),
            __turbopack_context__.A("[project]/node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/freighter.module.js [app-client] (ecmascript, async loader)")
        ]);
        loaded.init({
            modules: [
                new AlbedoModule(),
                new FreighterModule()
            ],
            selectedWalletId: ALBEDO_ID,
            network: passphrase
        });
        kit = loaded;
        configuredPassphrase = passphrase;
    })().catch((error)=>{
        loading = undefined;
        throw error;
    });
    await loading;
    if (configuredPassphrase !== passphrase) {
        if (connectedAddress) throw new Error('Disconnect before changing the app network.');
        kit.setNetwork(passphrase);
        configuredPassphrase = passphrase;
    }
}
async function connectKit(walletId, passphrase) {
    if (walletId !== 'albedo' && walletId !== 'freighter') throw new Error('Unsupported wallet.');
    validateNetwork(passphrase);
    if (!isKitReady(passphrase)) throw new Error('Wallet is still loading. Wait a moment, then connect again.');
    if (request.isBusy) throw new Error('Another wallet request is already open. Cancel it before trying again.');
    const attempt = ++generation;
    connectedAddress = null;
    selected = walletId;
    kit.setWallet(walletId);
    // No await before dispatch: Safari needs window.open in this button click.
    let address;
    try {
        ({ address } = await request.run(()=>kit.fetchAddress(), CONNECT_TIMEOUT_MS, {
            watchPopup: walletId === 'albedo'
        }));
    } catch (error) {
        throw describeWalletError(error, walletId);
    }
    if (attempt !== generation) throw new Error('Wallet selection changed. Connect again.');
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidEd25519PublicKey(address)) throw new Error('Wallet did not return a valid Stellar account.');
    connectedAddress = address;
    return address;
}
function cancelKitRequest() {
    generation++;
    request.cancel();
}
async function disconnectKit() {
    cancelKitRequest();
    connectedAddress = null;
    if (kit) await kit.disconnect();
}
async function getKitNetwork() {
    if (!kit || !configuredPassphrase) throw new Error('Connect your wallet first.');
    // Albedo has no network getter. Each request specifies its network and the returned signature is verified against it.
    if (selected === 'albedo') return {
        network: configuredPassphrase === __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$network$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Networks"].PUBLIC ? 'PUBLIC' : 'TESTNET',
        networkPassphrase: configuredPassphrase
    };
    return request.run(()=>kit.getNetwork(), QUICK_TIMEOUT_MS).catch((error)=>{
        throw describeWalletError(error, 'freighter');
    });
}
function validateWalletSignature(unsignedXdr, signedXdr, address, passphrase, signerAddress) {
    validateNetwork(passphrase);
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$strkey$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StrKey"].isValidEd25519PublicKey(address) || signerAddress && signerAddress !== address) throw new Error('Wallet signed with another account. Reconnect before signing.');
    const original = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"].fromXDR(unsignedXdr, passphrase), signed = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"].fromXDR(signedXdr, passphrase);
    if (!(original instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Transaction"]) || !(signed instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Transaction"]) || original.source !== address || signed.source !== address) throw new Error('Unexpected wallet transaction source or envelope.');
    const preparedHash = original.hash(), signedHash = signed.hash();
    if (preparedHash.length !== signedHash.length || preparedHash.some((byte, i)=>byte !== signedHash[i])) throw new Error('Wallet changed the prepared transaction.');
    const publicKey = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$keypair$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Keypair"].fromPublicKey(address);
    if (!signed.signatures.some((signature)=>{
        try {
            return publicKey.verify(signed.hash(), signature.signature);
        } catch (e) {
            return false;
        }
    })) throw new Error('Wallet signature does not match the selected account and network.');
    return signedXdr;
}
async function signKitTransaction(xdr, address, passphrase) {
    validateNetwork(passphrase);
    if (!kit || !connectedAddress || connectedAddress !== address || configuredPassphrase !== passphrase) throw new Error('The connected wallet or network changed. Reconnect before signing.');
    const original = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"].fromXDR(xdr, passphrase);
    if (!(original instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Transaction"]) || original.source !== address) throw new Error('Unexpected wallet transaction source or envelope.');
    const attempt = generation, wallet = selected;
    // One deadline for the whole signing attempt, so the wallet never outlives the transaction's timebound.
    const deadline = Date.now() + signingWindowMs(original);
    const remaining = ()=>{
        const left = deadline - Date.now();
        if (left <= 0) throw new Error('Transaction expired. Review the action again.');
        return left;
    };
    let result;
    try {
        if (wallet === 'freighter') {
            const current = await request.run(()=>kit.fetchAddress(), Math.min(QUICK_TIMEOUT_MS * 2, remaining()));
            if (attempt !== generation) throw new Error('Wallet selection changed. Reconnect before signing.');
            if (current.address !== address) throw new Error('The selected wallet account changed. Reconnect before signing.');
            if ((await request.run(()=>kit.getNetwork(), Math.min(QUICK_TIMEOUT_MS, remaining()))).networkPassphrase !== passphrase) throw new Error('Switch your wallet to the selected app network before signing.');
        }
        if (attempt !== generation) throw new Error('Wallet selection changed. Reconnect before signing.');
        // Sign only: never request implicit permissions or call signAndSubmitTransaction.
        result = await request.run(()=>kit.signTransaction(xdr, {
                address,
                networkPassphrase: passphrase
            }), remaining(), {
            watchPopup: wallet === 'albedo'
        });
    } catch (error) {
        throw describeWalletError(error, wallet);
    }
    if (attempt !== generation || connectedAddress !== address) throw new Error('Wallet selection changed while signing. Reconnect and review again.');
    if (!result.signedTxXdr) throw new Error('Wallet did not return a signed transaction.');
    return validateWalletSignature(xdr, result.signedTxXdr, address, passphrase, result.signerAddress);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/wallet.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalletProvider",
    ()=>WalletProvider,
    "useWallet",
    ()=>useWallet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/transaction.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/transaction_builder.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/wallet/kit.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$request$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/wallet/request.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
const WalletContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const walletKey = 'peridot:wallet';
function readWalletChoice() {
    try {
        const v = window.localStorage.getItem(walletKey);
        return v === 'albedo' || v === 'freighter' ? v : null;
    } catch (e) {
        return null;
    }
}
function writeWalletChoice(v) {
    try {
        window.localStorage.setItem(walletKey, v);
    } catch (e) {}
}
const mockAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
function message(error) {
    return error instanceof Error ? error.message : typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Wallet request failed.';
}
function WalletProvider(param) {
    let { children } = param;
    _s();
    const [isReady, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks);
    const [signature, setSignature] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null), [signing, setSigning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false), [signNotice, setSignNotice] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const signatureRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null), dialogRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null), signingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const settleSignature = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[settleSignature]": (request, result)=>{
            if (signatureRef.current !== request) return;
            if (result instanceof Error) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cancelKitRequest"])();
            clearTimeout(request.timer);
            signatureRef.current = null;
            signingRef.current = false;
            setSignature(null);
            setSigning(false);
            setSignNotice('');
            if (result instanceof Error) request.reject(result);
            else request.resolve(result);
        }
    }["WalletProvider.useCallback[settleSignature]"], []);
    const cancelSignature = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[cancelSignature]": ()=>{
            const pending = signatureRef.current;
            if (pending) settleSignature(pending, new Error('Signature request cancelled. No transaction submitted. Close the Albedo window before trying again.'));
        }
    }["WalletProvider.useCallback[cancelSignature]"], [
        settleSignature
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            var _dialogRef_current, _dialogRef_current1;
            if (signature && !((_dialogRef_current = dialogRef.current) === null || _dialogRef_current === void 0 ? void 0 : _dialogRef_current.open)) (_dialogRef_current1 = dialogRef.current) === null || _dialogRef_current1 === void 0 ? void 0 : _dialogRef_current1.showModal();
        }
    }["WalletProvider.useEffect"], [
        signature
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>({
                "WalletProvider.useEffect": ()=>{
                    const pending = signatureRef.current;
                    if (pending) {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cancelKitRequest"])();
                        clearTimeout(pending.timer);
                        pending.reject(new Error('Wallet was closed before signing.'));
                        signatureRef.current = null;
                    }
                }
            })["WalletProvider.useEffect"]
    }["WalletProvider.useEffect"], []);
    const [address, setAddress] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? mockAddress : null);
    const [walletId, setWalletId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('albedo');
    const [networkMismatch, setMismatch] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false), [isConnecting, setConnecting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false), [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const flight = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false), version = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            const saved = readWalletChoice();
            if (saved) setWalletId(saved);
        }
    }["WalletProvider.useEffect"], []);
    const loadKit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[loadKit]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["initializeKit"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase).then({
                "WalletProvider.useCallback[loadKit]": ()=>{
                    setReady(true);
                    setError(null);
                }
            }["WalletProvider.useCallback[loadKit]"]).catch({
                "WalletProvider.useCallback[loadKit]": (e)=>setError("The wallet module failed to load: ".concat(message(e), " Reload the page, or try another browser. Safari needs site data enabled."))
            }["WalletProvider.useCallback[loadKit]"])
    }["WalletProvider.useCallback[loadKit]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) void loadKit();
        }
    }["WalletProvider.useEffect"], [
        loadKit
    ]);
    const connect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[connect]": async ()=>{
            if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) {
                setAddress(mockAddress);
                return;
            }
            if (flight.current) return;
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isKitReady"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase)) {
                setError('Wallet is still loading. Click Connect wallet again in a moment.');
                void loadKit();
                return;
            }
            flight.current = true;
            setConnecting(true);
            setError(null);
            const attempt = ++version.current;
            try {
                const connected = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectKit"])(walletId, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase);
                const current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getKitNetwork"])();
                if (attempt !== version.current) return;
                setAddress(connected);
                setMismatch(current.networkPassphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase);
            } catch (e) {
                if (attempt === version.current) setError(message(e));
            } finally{
                if (attempt === version.current) {
                    flight.current = false;
                    setConnecting(false);
                }
            }
        }
    }["WalletProvider.useCallback[connect]"], [
        walletId,
        loadKit
    ]);
    const disconnect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[disconnect]": ()=>{
            cancelSignature();
            version.current++;
            flight.current = false;
            setAddress(null);
            setMismatch(false);
            setError(null);
            setConnecting(false);
            if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) void (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["disconnectKit"])().catch({
                "WalletProvider.useCallback[disconnect]": (e)=>setError(message(e))
            }["WalletProvider.useCallback[disconnect]"]);
        }
    }["WalletProvider.useCallback[disconnect]"], [
        cancelSignature
    ]);
    const selectWallet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[selectWallet]": (wallet)=>{
            if (flight.current) return;
            disconnect();
            setWalletId(wallet);
            writeWalletChoice(wallet);
        }
    }["WalletProvider.useCallback[selectWallet]"], [
        disconnect
    ]);
    // Freighter has no network-change event the app can rely on. Re-check when the user returns from switching networks, otherwise the mismatch banner would never clear.
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "WalletProvider.useEffect": ()=>{
            if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks || !address || !networkMismatch || walletId !== 'freighter') return;
            const recheck = {
                "WalletProvider.useEffect.recheck": ()=>{
                    void (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getKitNetwork"])().then({
                        "WalletProvider.useEffect.recheck": (current)=>setMismatch(current.networkPassphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase)
                    }["WalletProvider.useEffect.recheck"]).catch({
                        "WalletProvider.useEffect.recheck": ()=>{}
                    }["WalletProvider.useEffect.recheck"]);
                }
            }["WalletProvider.useEffect.recheck"];
            window.addEventListener('focus', recheck);
            document.addEventListener('visibilitychange', recheck);
            return ({
                "WalletProvider.useEffect": ()=>{
                    window.removeEventListener('focus', recheck);
                    document.removeEventListener('visibilitychange', recheck);
                }
            })["WalletProvider.useEffect"];
        }
    }["WalletProvider.useEffect"], [
        address,
        networkMismatch,
        walletId
    ]);
    const signTransaction = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "WalletProvider.useCallback[signTransaction]": async (xdr)=>{
            if (!address) throw new Error('Connect your wallet first.');
            if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) throw new Error('Mock mode does not request wallet signatures.');
            if (walletId === 'albedo') {
                var _tx_timeBounds;
                if (signatureRef.current) throw new Error('Another signature request is already waiting.');
                const tx = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"].fromXDR(xdr, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase);
                if (!(tx instanceof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Transaction"]) || tx.source !== address) throw new Error('Unexpected transaction source.');
                const expires = Number((_tx_timeBounds = tx.timeBounds) === null || _tx_timeBounds === void 0 ? void 0 : _tx_timeBounds.maxTime) * 1000;
                if (!Number.isSafeInteger(expires) || expires <= Date.now() + 10_000) throw new Error('Transaction expired. Review the action again.');
                const operation = tx.operations[0];
                const method = (operation === null || operation === void 0 ? void 0 : operation.type) === 'invokeHostFunction' && operation.func.type === 'hostFunctionTypeInvokeContract' ? operation.func.invokeContract.functionName.toString() : (operation === null || operation === void 0 ? void 0 : operation.type) === 'changeTrust' ? 'Add asset trustline' : 'Transaction';
                return new Promise({
                    "WalletProvider.useCallback[signTransaction]": (resolve, reject)=>{
                        const request = {
                            xdr,
                            address,
                            method,
                            fee: tx.fee,
                            expires,
                            resolve,
                            reject,
                            timer: setTimeout({
                                "WalletProvider.useCallback[signTransaction]": ()=>settleSignature(request, new Error('Transaction review expired. Review the action again.'))
                            }["WalletProvider.useCallback[signTransaction]"], expires - Date.now() - 10_000)
                        };
                        signatureRef.current = request;
                        setSignature(request);
                    }
                }["WalletProvider.useCallback[signTransaction]"]);
            }
            const current = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getKitNetwork"])();
            const wrong = current.networkPassphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase;
            setMismatch(wrong);
            if (wrong) throw new Error("Switch your wallet to ".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, " before signing."));
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["signKitTransaction"])(xdr, address, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase);
        }
    }["WalletProvider.useCallback[signTransaction]"], [
        address,
        walletId,
        settleSignature
    ]);
    const openSignature = ()=>{
        const request = signatureRef.current;
        if (!request || signingRef.current) return;
        if (request.address !== address || request.expires <= Date.now() + 10_000) {
            settleSignature(request, new Error('Wallet changed or transaction expired. Review again.'));
            return;
        }
        signingRef.current = true;
        setSigning(true);
        setSignNotice('');
        // Invoke synchronously from this click: Safari requires a new gesture after simulation.
        void (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$kit$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["signKitTransaction"])(request.xdr, request.address, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase).then((result)=>settleSignature(request, request.expires > Date.now() + 10_000 ? result : new Error('Transaction expired. Review the action again.'))).catch((e)=>{
            // A blocked or closed Albedo window is fixable in place: keep the reviewed transaction and let the user try again without re-simulating.
            if (e instanceof __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$wallet$2f$request$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["WalletWindowError"] && signatureRef.current === request && request.expires > Date.now() + 10_000) {
                signingRef.current = false;
                setSigning(false);
                setSignNotice(e.message);
                return;
            }
            settleSignature(request, new Error(message(e)));
        });
    };
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "WalletProvider.useMemo[value]": ()=>({
                address,
                walletId,
                selectWallet,
                connect,
                disconnect,
                networkMismatch,
                isConnecting,
                isReady,
                error,
                signTransaction
            })
    }["WalletProvider.useMemo[value]"], [
        address,
        walletId,
        selectWallet,
        connect,
        disconnect,
        networkMismatch,
        isConnecting,
        isReady,
        error,
        signTransaction
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(WalletContext.Provider, {
        value: value,
        children: [
            children,
            signature && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dialog", {
                ref: dialogRef,
                "aria-labelledby": "albedo-sign-title",
                onCancel: (e)=>{
                    e.preventDefault();
                    cancelSignature();
                },
                style: {
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 24,
                    maxWidth: 460,
                    width: 'calc(100% - 32px)'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "stack",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                            id: "albedo-sign-title",
                            children: "Ready to sign with Albedo"
                        }, void 0, false, {
                            fileName: "[project]/src/lib/peridot/wallet.tsx",
                            lineNumber: 105,
                            columnNumber: 28
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "The transaction check is complete. Open Albedo below to review and sign."
                        }, void 0, false, {
                            fileName: "[project]/src/lib/peridot/wallet.tsx",
                            lineNumber: 105,
                            columnNumber: 85
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: [
                                "Action: ",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                    children: signature.method.replaceAll('_', ' ')
                                }, void 0, false, {
                                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                                    lineNumber: 105,
                                    columnNumber: 175
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                                    lineNumber: 105,
                                    columnNumber: 230
                                }, this),
                                "Network: ",
                                __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name,
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                                    lineNumber: 105,
                                    columnNumber: 258
                                }, this),
                                "Maximum fee: ",
                                (Number(signature.fee) / 10_000_000).toFixed(7),
                                " XLM",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                                    lineNumber: 105,
                                    columnNumber: 327
                                }, this),
                                "Account: ",
                                signature.address.slice(0, 6),
                                "…",
                                signature.address.slice(-6)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/lib/peridot/wallet.tsx",
                            lineNumber: 105,
                            columnNumber: 164
                        }, this),
                        signing && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            role: "status",
                            children: "Waiting for Albedo. If no window appeared, allow pop-ups for this site, then cancel and try again."
                        }, void 0, false, {
                            fileName: "[project]/src/lib/peridot/wallet.tsx",
                            lineNumber: 105,
                            columnNumber: 415
                        }, this),
                        signNotice && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            role: "alert",
                            children: signNotice
                        }, void 0, false, {
                            fileName: "[project]/src/lib/peridot/wallet.tsx",
                            lineNumber: 105,
                            columnNumber: 548
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "row",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    className: "button",
                                    disabled: signing,
                                    onClick: openSignature,
                                    children: signing ? 'Waiting for Albedo...' : signNotice ? 'Try again' : 'Open Albedo to sign'
                                }, void 0, false, {
                                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                                    lineNumber: 105,
                                    columnNumber: 602
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    type: "button",
                                    className: "button secondary",
                                    onClick: cancelSignature,
                                    children: "Cancel signing"
                                }, void 0, false, {
                                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                                    lineNumber: 105,
                                    columnNumber: 773
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/lib/peridot/wallet.tsx",
                            lineNumber: 105,
                            columnNumber: 581
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/lib/peridot/wallet.tsx",
                    lineNumber: 105,
                    columnNumber: 5
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/lib/peridot/wallet.tsx",
                lineNumber: 104,
                columnNumber: 70
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/lib/peridot/wallet.tsx",
        lineNumber: 104,
        columnNumber: 10
    }, this);
}
_s(WalletProvider, "V+jcYoPaxVWV7QsyrhsArolz0GM=");
_c = WalletProvider;
function useWallet() {
    _s1();
    const wallet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(WalletContext);
    if (!wallet) throw new Error('useWallet requires WalletProvider.');
    return wallet;
}
_s1(useWallet, "XvhONqEyCvan4BSMIEJ8UkNV8zc=");
var _c;
__turbopack_context__.k.register(_c, "WalletProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/read-scheduler.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Pace read-only RPC calls so loading several cards cannot burst past a public provider's limit. */ __turbopack_context__.s([
    "ReadScheduler",
    ()=>ReadScheduler,
    "isRateLimited",
    ()=>isRateLimited
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
;
class ReadScheduler {
    run(read) {
        return new Promise((resolve, reject)=>{
            this.queue.push(()=>{
                this.active++;
                this.nextStart = Date.now() + this.intervalMs;
                Promise.resolve().then(read).then(resolve, reject).finally(()=>{
                    this.active--;
                    this.pump();
                });
            });
            this.pump();
        });
    }
    pump() {
        if (this.timer || this.active >= this.concurrency || !this.queue.length) return;
        const delay = this.nextStart - Date.now();
        if (delay > 0) {
            this.timer = setTimeout(()=>{
                this.timer = undefined;
                this.pump();
            }, delay);
            return;
        }
        this.queue.shift()();
        this.pump();
    }
    constructor(concurrency = 3, intervalMs = 200){
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "concurrency", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "intervalMs", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "active", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "nextStart", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "timer", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "queue", void 0);
        this.concurrency = concurrency;
        this.intervalMs = intervalMs;
        this.active = 0;
        this.nextStart = 0;
        this.queue = [];
    }
}
function isRateLimited(error) {
    if (!error || typeof error !== 'object' || !('response' in error)) return false;
    const response = error.response;
    return !!response && typeof response === 'object' && 'status' in response && response.status === 429;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/ui-events.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Tiny UI event bus for transaction progress.
 *
 * `lib/peridot/rpc.ts` mirrors every `TxProgress` report into `emitTx`; the toast provider and the
 * recent-transactions popover subscribe with `onTx`. This module has no imports on purpose: it is
 * safe in node unit tests, during server rendering and inside `lib/peridot` without creating a cycle.
 * A listener can never break a transaction: handler errors are swallowed. */ __turbopack_context__.s([
    "emitTx",
    ()=>emitTx,
    "nextTxId",
    ()=>nextTxId,
    "onTx",
    ()=>onTx,
    "txListenerCount",
    ()=>txListenerCount
]);
const handlers = new Set();
let counter = 0;
function nextTxId() {
    counter += 1;
    return "tx-".concat(Date.now().toString(36), "-").concat(counter);
}
function emitTx(event) {
    const stamped = event.at ? event : {
        ...event,
        at: Date.now()
    };
    for (const handler of Array.from(handlers)){
        try {
            handler(stamped);
        } catch (e) {}
    }
}
function onTx(handler) {
    handlers.add(handler);
    return ()=>{
        handlers.delete(handler);
    };
}
function txListenerCount() {
    return handlers.size;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/read-failover.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Classify transport failures only. Contract and JSON-RPC failures must remain visible. */ __turbopack_context__.s([
    "ReadFailover",
    ()=>ReadFailover,
    "isReadTransportFailure",
    ()=>isReadTransportFailure
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
;
function isReadTransportFailure(error) {
    if (!error || typeof error !== 'object') return false;
    const record = error;
    const response = record.response;
    if (response && typeof response === 'object') {
        const { status, data } = response;
        if (status === 408 || status === 429) return true;
        if (data && typeof data === 'object' && 'error' in data) {
            const rpcError = data.error;
            if (rpcError && typeof rpcError === 'object' && 'code' in rpcError && typeof rpcError.code === 'number' && rpcError.code < 0) return false;
        }
        if (typeof status === 'number') return status === 408 || status === 429 || status >= 500 && status <= 599;
    }
    if (typeof record.code === 'number' && record.code < 0) return false;
    if (typeof record.code === 'string' && [
        'ERR_NETWORK',
        'ECONNABORTED',
        'ETIMEDOUT',
        'ECONNRESET',
        'ENOTFOUND',
        'EAI_AGAIN',
        'UND_ERR_CONNECT_TIMEOUT',
        'UND_ERR_HEADERS_TIMEOUT',
        'UND_ERR_BODY_TIMEOUT',
        'UND_ERR_SOCKET'
    ].includes(record.code)) return true;
    if (record.name === 'TimeoutError') return true;
    return record.name === 'TypeError' && typeof record.message === 'string' && [
        'Failed to fetch',
        'fetch failed',
        'Load failed',
        'NetworkError when attempting to fetch resource.'
    ].includes(record.message);
}
class ReadFailover {
    async run(primaryRead, fallbackRead) {
        if (this.now() < this.fallbackUntil) return this.readFallback(fallbackRead);
        try {
            return await primaryRead();
        } catch (error) {
            if (!isReadTransportFailure(error)) throw error;
            this.fallbackUntil = this.now() + this.cooldownMs;
            return this.readFallback(fallbackRead);
        }
    }
    async readFallback(read) {
        if (!this.verification) {
            const pending = Promise.resolve().then(this.verifyFallback).catch((error)=>{
                if (this.verification === pending) {
                    this.verification = undefined;
                    this.fallbackUntil = 0;
                }
                throw error;
            });
            this.verification = pending;
        }
        await this.verification;
        try {
            return await read();
        } catch (error) {
            // Do not bounce between providers inside one read. A future call can probe primary again.
            if (isReadTransportFailure(error)) {
                this.verification = undefined;
                this.fallbackUntil = 0;
            }
            throw error;
        }
    }
    constructor(verifyFallback, cooldownMs = 30_000, now = Date.now){
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "verifyFallback", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "cooldownMs", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "now", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "fallbackUntil", void 0);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "verification", void 0);
        this.verifyFallback = verifyFallback;
        this.cooldownMs = cooldownMs;
        this.now = now;
        this.fallbackUntil = 0;
        if (!Number.isFinite(cooldownMs) || cooldownMs < 0) throw new Error('Invalid read RPC failover cooldown.');
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TransactionRejectedError",
    ()=>TransactionRejectedError,
    "UnknownTransactionError",
    ()=>UnknownTransactionError,
    "assertRpcNetwork",
    ()=>assertRpcNetwork,
    "getPendingTransaction",
    ()=>getPendingTransaction,
    "getRpc",
    ()=>getRpc,
    "invalidateContractReads",
    ()=>invalidateContractReads,
    "isDefinitivelyExpired",
    ()=>isDefinitivelyExpired,
    "readContract",
    ()=>readContract,
    "readContractRaw",
    ()=>readContractRaw,
    "reconcilePendingTransaction",
    ()=>reconcilePendingTransaction,
    "rpcRead",
    ()=>rpcRead,
    "selectInclusionFee",
    ()=>selectInclusionFee,
    "submitContract",
    ()=>submitContract,
    "submitPreparedTrustline",
    ()=>submitPreparedTrustline,
    "waitForLedgerBeyond",
    ()=>waitForLedgerBeyond,
    "withWalletLock",
    ()=>withWalletLock
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$account$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/account.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/address.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/transaction_builder.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$contract$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/contract.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$rpc$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__rpc$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/rpc/index.js [app-client] (ecmascript) <export * as rpc>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/base/scval.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$read$2d$scheduler$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/read-scheduler.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui-events.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$read$2d$failover$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/read-failover.ts [app-client] (ecmascript)");
;
;
;
;
;
;
class UnknownTransactionError extends Error {
    constructor(hash){
        super("Confirmation is unavailable. Transaction ".concat(hash, " may still succeed. Check its status before trying again.")), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "hash", void 0), this.hash = hash;
        this.name = 'UnknownTransactionError';
    }
}
class TransactionRejectedError extends Error {
    constructor(hash, message){
        super(message), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "hash", void 0), this.hash = hash;
        this.name = 'TransactionRejectedError';
    }
}
let server;
let verifiedNetwork;
async function assertRpcNetwork() {
    if (!verifiedNetwork) verifiedNetwork = rpcRead('getNetwork').then((result)=>{
        if (result.passphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase) throw new Error('RPC network does not match the selected app network.');
    }).catch((error)=>{
        verifiedNetwork = undefined;
        throw error;
    });
    return verifiedNetwork;
}
function selectInclusionFee(percentile) {
    if (!/^\d+$/.test(percentile)) throw new Error('Current network fee data is unavailable. Try again.');
    const fee = BigInt(percentile) > BigInt(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BASE_FEE"]) ? BigInt(percentile) : BigInt(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BASE_FEE"]);
    if (fee > 100_000n) throw new Error('Current network inclusion fees exceed the app limit. Try again later.');
    return fee.toString();
}
function isDefinitivelyExpired(pending, result) {
    return result.status === 'NOT_FOUND' && Number.isSafeInteger(pending.maxTime) && pending.maxTime > 0 && Number.isSafeInteger(pending.submissionLedger) && pending.submissionLedger > 0 && result.oldestLedger <= pending.submissionLedger && result.latestLedger >= pending.submissionLedger && result.latestLedgerCloseTime > pending.maxTime;
}
const locks = new Set();
async function withWalletLock(address, action) {
    if (typeof navigator === 'undefined' || !navigator.locks) throw new Error('This browser cannot coordinate wallet transactions safely. Use a current browser over HTTPS or localhost.');
    return navigator.locks.request("peridot:wallet:".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, ":").concat(address), {
        mode: 'exclusive',
        ifAvailable: true
    }, async (lock)=>{
        if (!lock) throw new Error('Another tab is handling this wallet. Finish or close that operation before continuing.');
        return action();
    });
}
function clearPending(address, hash) {
    var _getPendingTransaction;
    if (((_getPendingTransaction = getPendingTransaction(address)) === null || _getPendingTransaction === void 0 ? void 0 : _getPendingTransaction.hash) === hash) persistPending(address, null);
}
function getRpc() {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].rpcUrl) throw new Error('Mainnet RPC is not configured. Set NEXT_PUBLIC_MAINNET_RPC_URL.');
    if (!server) server = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$rpc$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__rpc$3e$__["rpc"].Server(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].rpcUrl, {
        timeout: 10_000,
        allowHttp: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].rpcUrl.startsWith('http://localhost') || __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].rpcUrl.startsWith('http://127.0.0.1')
    });
    return server;
}
// Only this fixed set can fail over. sendTransaction is always called directly, once.
const READ_METHODS = [
    'getNetwork',
    'getAccount',
    'getLatestLedger',
    'getLedgerEntries',
    'getFeeStats',
    'getTransaction',
    'simulateTransaction'
];
let fallback;
function fallbackRpc() {
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].fallbackRpcUrl) throw new Error('No read fallback is configured.');
    if (!fallback) fallback = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$rpc$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__rpc$3e$__["rpc"].Server(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].fallbackRpcUrl, {
        timeout: 10_000
    });
    return fallback;
}
const readFailover = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$read$2d$failover$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ReadFailover"](async ()=>{
    if ((await fallbackRpc().getNetwork()).passphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase) throw new Error('Fallback RPC network does not match this app.');
});
async function rpcRead(method) {
    for(var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++){
        args[_key - 1] = arguments[_key];
    }
    if (!READ_METHODS.includes(method)) throw new Error('Only approved read methods can fail over.');
    const invoke = (client)=>Reflect.apply(client[method], client, args);
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].fallbackRpcUrl) return invoke(getRpc());
    return readFailover.run(()=>invoke(getRpc()), ()=>invoke(fallbackRpc()));
}
const pendingKey = (address)=>"peridot:pending:".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, ":").concat(address);
function getPendingTransaction(address) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        return JSON.parse(window.localStorage.getItem(pendingKey(address)) || 'null');
    } catch (e) {
        throw new Error('Pending transaction storage cannot be read. Enable browser storage before signing.');
    }
}
function persistPending(address, data) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        if (data) window.localStorage.setItem(pendingKey(address), JSON.stringify(data));
        else window.localStorage.removeItem(pendingKey(address));
    } catch (e) {
        throw new Error('Pending transaction storage is unavailable. Enable browser storage before signing.');
    }
}
async function reconcilePendingTransactionLocked(address) {
    const pending = getPendingTransaction(address);
    if (!pending) return 'none';
    await assertRpcNetwork();
    const result = await rpcRead('getTransaction', pending.hash);
    if (result.status === 'NOT_FOUND' && !isDefinitivelyExpired(pending, result)) return 'unknown';
    clearPending(address, pending.hash);
    invalidateContractReads();
    return result.status === 'SUCCESS' ? 'success' : result.status === 'NOT_FOUND' ? 'expired' : 'failed';
}
async function reconcilePendingTransaction(address) {
    return withWalletLock(address, ()=>reconcilePendingTransactionLocked(address));
}
// Coalesce only simultaneous identical reads. Never cache settled financial state.
const readScheduler = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$read$2d$scheduler$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ReadScheduler"]();
const reading = new Map();
function invalidateContractReads() {
    reading.clear();
}
function readContractRaw(contractId, method) {
    let args = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    const key = JSON.stringify([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name,
        contractId,
        method,
        args.map((arg)=>arg.toXDR('base64'))
    ]);
    const existing = reading.get(key);
    if (existing) return existing;
    const request = performRead(contractId, method, args).finally(()=>{
        if (reading.get(key) === request) reading.delete(key);
    });
    reading.set(key, request);
    return request;
}
async function performRead(contractId, method) {
    let args = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    await assertRpcNetwork();
    const tx = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$account$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Account"]('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0'), {
        fee: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BASE_FEE"],
        networkPassphrase: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase
    }).addOperation(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$contract$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Contract"](contractId).call(method, ...args)).setTimeout(120).build();
    let result;
    for(let attempt = 0;; attempt++){
        try {
            result = await readScheduler.run(()=>rpcRead('simulateTransaction', tx));
            break;
        } catch (error) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$read$2d$scheduler$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isRateLimited"])(error) || attempt >= 2) throw error;
            await new Promise((resolve)=>setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$rpc$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__rpc$3e$__["rpc"].Api.isSimulationSuccess(result) || !result.result) {
        throw new Error("Unable to read ".concat(method, ": ").concat('error' in result ? result.error : 'No result returned.'));
    }
    return result.result.retval;
}
async function readContract(contractId, method) {
    let args = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(await readContractRaw(contractId, method, args));
}
async function submitContract(input) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].readOnly) throw new Error('This preview is read-only. Transactions are not enabled.');
    // UI toasts (lib/ui-events.ts): mirror every progress report to the event bus. The caller's callback and the transaction path are unchanged.
    const txId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["nextTxId"])(), onProgress = (progress)=>{
        var _input_onProgress;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["emitTx"])({
            id: txId,
            method: input.method,
            contractId: input.contractId,
            ...progress
        });
        (_input_onProgress = input.onProgress) === null || _input_onProgress === void 0 ? void 0 : _input_onProgress.call(input, progress);
    };
    try {
        return await withWalletLock(input.signer.address, ()=>submitContractLocked({
                ...input,
                onProgress
            }));
    } finally{
        invalidateContractReads();
    }
}
async function submitPreparedTrustline(input) {
    return submitContract({
        contractId: input.token,
        method: 'change_trust',
        signer: input.signer,
        onProgress: input.onProgress,
        prepareClassic: ()=>{
            const tx = input.validate();
            if (tx.source !== input.signer.address || tx.operations.length !== 1 || tx.operations[0].type !== 'changeTrust' || tx.signatures.length) throw new Error('Unexpected prepared trustline transaction.');
            return tx;
        }
    });
}
async function submitContractLocked(input) {
    const { contractId, method, signer, onProgress } = input;
    if (__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks) throw new Error('Live transactions are disabled in mock mode.');
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$address$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Address"].fromString(signer.address);
    const lock = "".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, ":").concat(signer.address);
    if (locks.has(lock)) throw new Error('Another wallet transaction is already in progress.');
    locks.add(lock);
    let submittedHash;
    try {
        var _prepared_timeBounds;
        const pending = getPendingTransaction(signer.address);
        if (pending) {
            const status = await reconcilePendingTransactionLocked(signer.address);
            if (status === 'unknown') throw new UnknownTransactionError(pending.hash);
            submittedHash = pending.hash;
            const outcome = status === 'success' ? 'confirmed' : status === 'expired' ? 'expired without confirmation' : 'failed on chain';
            throw new Error("Previous transaction ".concat(pending.hash, " ").concat(outcome, ". No new transaction was sent. Refresh balances, then review and submit the action again."));
        }
        const client = getRpc();
        // The submission endpoint itself must be on the correct network, even when reads fail over.
        if ((await client.getNetwork()).passphrase !== __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase) throw new Error('Submission RPC network does not match this app.');
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'simulating',
            message: 'Checking balances, current fees and transaction limits.'
        });
        const account = await rpcRead('getAccount', signer.address);
        let prepared;
        if (input.prepareClassic) {
            prepared = input.prepareClassic();
            if (BigInt(prepared.sequence) !== BigInt(account.sequenceNumber()) + 1n) throw new Error('Wallet activity changed the account sequence. Review the trustline again.');
        } else {
            const fees = await rpcRead('getFeeStats');
            const fee = selectInclusionFee(fees.sorobanInclusionFee.p95);
            const tx = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"](account, {
                fee,
                networkPassphrase: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase
            }).addOperation(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$contract$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Contract"](contractId).call(method, ...input.args || [])).setTimeout(180).build();
            const simulation = await rpcRead('simulateTransaction', tx);
            if (!__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$rpc$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__rpc$3e$__["rpc"].Api.isSimulationSuccess(simulation)) {
                throw new Error("Simulation failed: ".concat('error' in simulation ? simulation.error : 'Archived contract data must be restored before this transaction.'));
            }
            prepared = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$rpc$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__rpc$3e$__["rpc"].assembleTransaction(tx, simulation).build();
        }
        const submissionLedger = (await rpcRead('getLatestLedger')).sequence;
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'signing'
        });
        const signedXdr = await signer.signTransaction(prepared.toXDR());
        const signed = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$transaction_builder$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TransactionBuilder"].fromXDR(signedXdr, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].passphrase);
        if (signed.hash().length !== prepared.hash().length || signed.hash().some((value, index)=>value !== prepared.hash()[index])) throw new Error('Wallet returned a different transaction.');
        submittedHash = Array.from(signed.hash(), (value)=>value.toString(16).padStart(2, '0')).join('');
        persistPending(signer.address, {
            hash: submittedHash,
            contractId,
            method,
            maxTime: Number((_prepared_timeBounds = prepared.timeBounds) === null || _prepared_timeBounds === void 0 ? void 0 : _prepared_timeBounds.maxTime),
            submissionLedger
        });
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'submitting',
            hash: submittedHash,
            message: 'Signature received. Submitting this transaction once.'
        });
        let submission;
        // A 429 means the provider never accepted the envelope. Re-sending the identical signed bytes is idempotent (same hash), so retry before declaring the outcome unknown.
        for(let attempt = 0;; attempt++){
            try {
                submission = await client.sendTransaction(signed);
                break;
            } catch (error) {
                if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$read$2d$scheduler$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isRateLimited"])(error) || attempt >= 2) throw new UnknownTransactionError(submittedHash);
                await new Promise((resolve)=>setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        if (submission.status === 'ERROR') {
            var _submission_errorResult;
            clearPending(signer.address, submittedHash);
            throw new TransactionRejectedError(submittedHash, "Transaction rejected: ".concat(((_submission_errorResult = submission.errorResult) === null || _submission_errorResult === void 0 ? void 0 : _submission_errorResult.toXDR('base64')) || 'Check balances, limits and permissions.'));
        }
        if (submission.status === 'TRY_AGAIN_LATER') throw new UnknownTransactionError(submittedHash);
        if (submission.hash !== submittedHash) throw new UnknownTransactionError(submittedHash);
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: 'confirming',
            hash: submittedHash,
            message: 'Submitted. Waiting for a ledger confirmation. Do not submit again.'
        });
        const deadline = Date.now() + 90_000;
        while(Date.now() < deadline){
            let result;
            try {
                result = await rpcRead('getTransaction', submittedHash);
            } catch (e) {
                await new Promise((resolve)=>setTimeout(resolve, 1500));
                continue;
            }
            if (result.status === 'SUCCESS') {
                clearPending(signer.address, submittedHash);
                onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                    status: 'success',
                    hash: submittedHash,
                    message: "Confirmed in ledger ".concat(result.ledger, ". Updating your balances.")
                });
                return {
                    hash: submittedHash,
                    ledger: result.ledger,
                    value: result.returnValue ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$base$2f$scval$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["scValToNative"])(result.returnValue) : undefined
                };
            }
            if (result.status === 'FAILED') {
                clearPending(signer.address, submittedHash);
                onProgress === null || onProgress === void 0 ? void 0 : onProgress({
                    status: 'error',
                    hash: submittedHash,
                    message: 'The transaction failed on chain.'
                });
                throw new Error('The transaction failed on chain. Refresh state before trying again.');
            }
            await new Promise((resolve)=>setTimeout(resolve, 1500));
        }
        throw new UnknownTransactionError(submittedHash);
    } catch (error) {
        onProgress === null || onProgress === void 0 ? void 0 : onProgress({
            status: error instanceof UnknownTransactionError ? 'unknown' : 'error',
            hash: error instanceof UnknownTransactionError ? error.hash : submittedHash,
            message: error instanceof Error ? error.message : 'Transaction failed.'
        });
        throw error;
    } finally{
        locks.delete(lock);
    }
}
async function waitForLedgerBeyond(ledger) {
    const deadline = Date.now() + 30_000;
    while(Date.now() < deadline){
        if ((await rpcRead('getLatestLedger')).sequence > ledger) return;
        await new Promise((resolve)=>setTimeout(resolve, 1000));
    }
    throw new Error('The next ledger is not available yet. Refresh chain state before the next stage.');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/ThemeToggle.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeToggle",
    ()=>ThemeToggle,
    "themeScript",
    ()=>themeScript
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/moon.js [app-client] (ecmascript) <export default as Moon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sun.js [app-client] (ecmascript) <export default as Sun>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
const KEY = 'peridot:theme';
const themeScript = "(function(){try{var t=localStorage.getItem('".concat(KEY, "');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();");
function ThemeToggle() {
    _s();
    const [theme, setTheme] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('dark');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeToggle.useEffect": ()=>{
            setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
        }
    }["ThemeToggle.useEffect"], []);
    const toggle = ()=>{
        const next = theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        try {
            localStorage.setItem(KEY, next);
        } catch (e) {}
        setTheme(next);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        className: "theme-toggle",
        onClick: toggle,
        "aria-label": theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme',
        title: theme === 'light' ? 'Dark theme' : 'Light theme',
        children: theme === 'light' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
            size: 16,
            "aria-hidden": true
        }, void 0, false, {
            fileName: "[project]/src/components/ui/ThemeToggle.tsx",
            lineNumber: 20,
            columnNumber: 26
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sun$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sun$3e$__["Sun"], {
            size: 16,
            "aria-hidden": true
        }, void 0, false, {
            fileName: "[project]/src/components/ui/ThemeToggle.tsx",
            lineNumber: 20,
            columnNumber: 59
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/ThemeToggle.tsx",
        lineNumber: 19,
        columnNumber: 10
    }, this);
}
_s(ThemeToggle, "D0ekClnfIGVExrH5c3Ka+aWcxxE=");
_c = ThemeToggle;
var _c;
__turbopack_context__.k.register(_c, "ThemeToggle");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/ui/recent-transactions.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Recent transactions kept per network in localStorage for the header popover.
 *
 * Loosely follows PeridotV2Full 86ae3795 `components/steallar/TransactionStrip.tsx` (a backend-fed
 * activity strip). Here the source is the local transaction event bus only: no backend, no points. */ __turbopack_context__.s([
    "RECENT_TX_LIMIT",
    ()=>RECENT_TX_LIMIT,
    "loadRecent",
    ()=>loadRecent,
    "methodLabel",
    ()=>methodLabel,
    "recentTxKey",
    ()=>recentTxKey,
    "relativeTime",
    ()=>relativeTime,
    "saveRecent",
    ()=>saveRecent,
    "statusFromTx",
    ()=>statusFromTx,
    "upsertRecent",
    ()=>upsertRecent
]);
const RECENT_TX_LIMIT = 10;
const recentTxKey = (networkName)=>"peridot:recent-tx:".concat(networkName);
function statusFromTx(status) {
    switch(status){
        case 'submitting':
        case 'confirming':
            return 'pending';
        case 'success':
            return 'success';
        case 'error':
            return 'failed';
        case 'unknown':
            return 'unknown';
        default:
            return null; // simulating and signing have no hash yet
    }
}
function isRecentTx(value) {
    if (!value || typeof value !== 'object') return false;
    const v = value;
    return typeof v.hash === 'string' && v.hash.length > 0 && typeof v.at === 'number' && (v.status === 'pending' || v.status === 'success' || v.status === 'failed' || v.status === 'unknown');
}
function loadRecent(storage, networkName) {
    if (!storage) return [];
    try {
        const parsed = JSON.parse(storage.getItem(recentTxKey(networkName)) || '[]');
        return Array.isArray(parsed) ? parsed.filter(isRecentTx).slice(0, RECENT_TX_LIMIT) : [];
    } catch (e) {
        return [];
    }
}
function saveRecent(storage, networkName, list) {
    if (!storage) return false;
    try {
        if (list.length === 0) storage.removeItem(recentTxKey(networkName));
        else storage.setItem(recentTxKey(networkName), JSON.stringify(list.slice(0, RECENT_TX_LIMIT)));
        return true;
    } catch (e) {
        return false;
    }
}
function upsertRecent(list, entry) {
    const existing = list.find((item)=>item.hash === entry.hash);
    var _entry_method;
    const merged = existing ? {
        ...existing,
        ...entry,
        at: existing.at,
        method: (_entry_method = entry.method) !== null && _entry_method !== void 0 ? _entry_method : existing.method
    } : entry;
    return [
        merged,
        ...list.filter((item)=>item.hash !== entry.hash)
    ].slice(0, RECENT_TX_LIMIT);
}
function methodLabel(method) {
    if (!method) return 'Transaction';
    const words = method.replace(/_/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
function relativeTime(at) {
    let now = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Date.now();
    const seconds = Math.max(0, Math.round((now - at) / 1000));
    if (seconds < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return "".concat(minutes, " min ago");
    const hours = Math.round(minutes / 60);
    if (hours < 24) return "".concat(hours, " h ago");
    return "".concat(Math.round(hours / 24), " d ago");
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/primitives.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Badge",
    ()=>Badge,
    "Countdown",
    ()=>Countdown,
    "EmptyState",
    ()=>EmptyState,
    "KeyValue",
    ()=>KeyValue,
    "Meter",
    ()=>Meter,
    "Notice",
    ()=>Notice,
    "Skeleton",
    ()=>Skeleton,
    "Stat",
    ()=>Stat,
    "Stepper",
    ()=>Stepper,
    "Tabs",
    ()=>Tabs,
    "Tooltip",
    ()=>Tooltip
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/info.js [app-client] (ecmascript) <export default as Info>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/octagon-alert.js [app-client] (ecmascript) <export default as OctagonAlert>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function Badge(param) {
    let { tone = 'neutral', children, className = '', icon: Icon, title } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "badge ".concat(tone === 'neutral' ? '' : tone, " ").concat(className).trim(),
        title: title,
        children: [
            Icon && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                "aria-hidden": true
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 8,
                columnNumber: 113
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 8,
        columnNumber: 10
    }, this);
}
_c = Badge;
function Stat(param) {
    let { label, value, unit, hint, large = false, tip } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "stat",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "stat-label",
                children: [
                    label,
                    tip && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Tooltip, {
                        text: tip
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 13,
                        columnNumber: 49
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 13,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "stat-value".concat(large ? ' large' : ''),
                children: [
                    value,
                    unit && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("small", {
                        children: unit
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 14,
                        columnNumber: 76
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 14,
                columnNumber: 5
            }, this),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "stat-hint",
                children: hint
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 15,
                columnNumber: 14
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 12,
        columnNumber: 10
    }, this);
}
_c1 = Stat;
function Meter(param) {
    let { label, value, pct, tone, thin = false, hint, ariaLabel } = param;
    const clamped = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
    const auto = tone !== null && tone !== void 0 ? tone : clamped >= 90 ? 'danger' : clamped >= 75 ? 'warn' : 'accent';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "meter".concat(thin ? ' thin' : ''),
        children: [
            (label || value) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "meter-row",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 24,
                        columnNumber: 53
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "meter-value",
                        children: value
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 24,
                        columnNumber: 73
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 24,
                columnNumber: 26
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "meter-track",
                role: "progressbar",
                "aria-valuenow": Math.round(clamped),
                "aria-valuemin": 0,
                "aria-valuemax": 100,
                "aria-label": ariaLabel || (typeof label === 'string' ? label : undefined),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "meter-fill ".concat(auto === 'accent' ? '' : auto),
                    style: {
                        width: "".concat(clamped, "%")
                    }
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/primitives.tsx",
                    lineNumber: 26,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 25,
                columnNumber: 5
            }, this),
            hint && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "meter-row",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    children: hint
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/primitives.tsx",
                    lineNumber: 28,
                    columnNumber: 41
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 28,
                columnNumber: 14
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 23,
        columnNumber: 10
    }, this);
}
_c2 = Meter;
function Tooltip(param) {
    let { text, label = 'More information', align } = param;
    _s();
    const id = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "tip".concat(align ? " ".concat(align) : ''),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "tip-trigger",
                "aria-label": label,
                "aria-describedby": id,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"], {
                    size: 11,
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/primitives.tsx",
                    lineNumber: 36,
                    columnNumber: 92
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 36,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                role: "tooltip",
                id: id,
                className: "tip-bubble",
                children: text
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 37,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 35,
        columnNumber: 10
    }, this);
}
_s(Tooltip, "WhsuKpSQZEWeFcB7gWlfDRQktoQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c3 = Tooltip;
function Skeleton(param) {
    let { width, height = 14, className = '', style } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "skeleton ".concat(className).trim(),
        "aria-hidden": true,
        style: {
            display: 'block',
            width: width !== null && width !== void 0 ? width : '100%',
            height,
            ...style
        }
    }, void 0, false, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 42,
        columnNumber: 10
    }, this);
}
_c4 = Skeleton;
const noticeIcons = {
    neutral: null,
    info: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"],
    warn: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"],
    danger: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonAlert$3e$__["OctagonAlert"],
    success: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"]
};
function Notice(param) {
    let { tone = 'neutral', children, role, title, className = '', live } = param;
    const Icon = noticeIcons[tone];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "status ".concat(tone === 'neutral' ? '' : tone, " ").concat(className).trim(),
        role: role,
        "aria-live": live,
        children: [
            Icon && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                size: 16,
                "aria-hidden": true
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 49,
                columnNumber: 14
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    minWidth: 0,
                    flex: 1
                },
                children: [
                    title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                        style: {
                            display: 'block',
                            marginBottom: 2
                        },
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 50,
                        columnNumber: 53
                    }, this),
                    children
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 50,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 48,
        columnNumber: 10
    }, this);
}
_c5 = Notice;
function EmptyState(param) {
    let { icon: Icon, title, children, action, role } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "panel empty-state",
        role: role,
        children: [
            Icon && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                size: 28,
                "aria-hidden": true
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 56,
                columnNumber: 14
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                children: title
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 57,
                columnNumber: 5
            }, this),
            children,
            action
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 55,
        columnNumber: 10
    }, this);
}
_c6 = EmptyState;
function Tabs(param) {
    let { items, value, onChange, block = false, ariaLabel, disabled } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "tabs".concat(block ? ' block' : ''),
        role: "group",
        "aria-label": ariaLabel,
        children: items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: item.value === value ? 'selected' : '',
                "aria-pressed": item.value === value,
                disabled: disabled,
                onClick: ()=>onChange(item.value),
                children: item.label
            }, item.value, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 66,
                columnNumber: 24
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 65,
        columnNumber: 10
    }, this);
}
_c7 = Tabs;
function Stepper(param) {
    let { steps, current, onSelect, disabled, ariaLabel } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
        className: "stepper",
        "aria-label": ariaLabel,
        children: steps.map((name, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    type: "button",
                    disabled: disabled,
                    "aria-current": i === current ? 'step' : undefined,
                    className: i === current ? 'selected' : i < current ? 'visited' : '',
                    onClick: ()=>onSelect(i),
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            "aria-hidden": true,
                            children: i < current ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                size: 12
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/primitives.tsx",
                                lineNumber: 74,
                                columnNumber: 42
                            }, this) : i + 1
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/primitives.tsx",
                            lineNumber: 74,
                            columnNumber: 9
                        }, this),
                        name
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/primitives.tsx",
                    lineNumber: 73,
                    columnNumber: 7
                }, this)
            }, name, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 72,
                columnNumber: 29
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 71,
        columnNumber: 10
    }, this);
}
_c8 = Stepper;
function Countdown(param) {
    let { secondsLeft, total = 60, readyText = 'Ready to apply' } = param;
    const pct = total > 0 ? Math.max(0, Math.min(100, 100 - secondsLeft / total * 100)) : 100;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "countdown",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "countdown-ring",
                style: {
                    ['--p']: "".concat(pct, "%")
                },
                "aria-hidden": true
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 84,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: secondsLeft > 0 ? "Applies in ".concat(secondsLeft, "s") : readyText
            }, void 0, false, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 85,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 83,
        columnNumber: 10
    }, this);
}
_c9 = Countdown;
function KeyValue(param) {
    let { rows } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "kv",
        children: rows.map((param, i)=>{
            let [k, v] = param;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: k
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 90,
                        columnNumber: 68
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: v
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/primitives.tsx",
                        lineNumber: 90,
                        columnNumber: 84
                    }, this)
                ]
            }, i, true, {
                fileName: "[project]/src/components/ui/primitives.tsx",
                lineNumber: 90,
                columnNumber: 55
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/src/components/ui/primitives.tsx",
        lineNumber: 90,
        columnNumber: 10
    }, this);
}
_c10 = KeyValue;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10;
__turbopack_context__.k.register(_c, "Badge");
__turbopack_context__.k.register(_c1, "Stat");
__turbopack_context__.k.register(_c2, "Meter");
__turbopack_context__.k.register(_c3, "Tooltip");
__turbopack_context__.k.register(_c4, "Skeleton");
__turbopack_context__.k.register(_c5, "Notice");
__turbopack_context__.k.register(_c6, "EmptyState");
__turbopack_context__.k.register(_c7, "Tabs");
__turbopack_context__.k.register(_c8, "Stepper");
__turbopack_context__.k.register(_c9, "Countdown");
__turbopack_context__.k.register(_c10, "KeyValue");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/peridot/amount.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Exact conversion. User amounts never pass through floating point. */ __turbopack_context__.s([
    "formatAmount",
    ()=>formatAmount,
    "parseAmount",
    ()=>parseAmount
]);
function parseAmount(value, decimals) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimals.');
    const clean = value.trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(clean)) throw new Error('Enter a nonnegative decimal amount.');
    const [whole, fraction = ''] = clean.split('.');
    if (fraction.length > decimals) throw new Error("This token supports ".concat(decimals, " decimal places."));
    const result = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
    if (result > (1n << 127n) - 1n) throw new Error('Amount is too large.');
    return result;
}
function formatAmount(value, decimals) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimals.');
    const sign = value < 0n ? '-' : '';
    const abs = value < 0n ? -value : value;
    const scale = 10n ** BigInt(decimals);
    const fraction = (abs % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
    return "".concat(sign).concat(abs / scale).concat(fraction ? ".".concat(fraction) : '');
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/format.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Presentational number formatting. Exact math stays in lib/peridot/amount.ts; these helpers only
 * shape already-computed values for display and never feed a transaction. */ __turbopack_context__.s([
    "fmtAmount",
    ()=>fmtAmount,
    "fmtBps",
    ()=>fmtBps,
    "fmtCompact",
    ()=>fmtCompact,
    "fmtDate",
    ()=>fmtDate,
    "fmtDuration",
    ()=>fmtDuration,
    "fmtNumber",
    ()=>fmtNumber,
    "fmtPct",
    ()=>fmtPct,
    "fmtScaledPct",
    ()=>fmtScaledPct,
    "runwayDays",
    ()=>runwayDays,
    "shortAddress",
    ()=>shortAddress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$amount$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/amount.ts [app-client] (ecmascript)");
;
const groupFormatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 20
});
function fmtAmount(value, decimals) {
    let maxFraction = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 2;
    const exact = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$amount$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAmount"])(value, decimals);
    const [whole, fraction = ''] = exact.split('.');
    const neg = whole.startsWith('-');
    const digits = neg ? whole.slice(1) : whole;
    const grouped = groupFormatter.format(BigInt(digits || '0'));
    let frac = fraction.slice(0, maxFraction).replace(/0+$/, '');
    if (!frac && fraction && value !== 0n && BigInt(digits || '0') === 0n) {
        // Below the display precision: show the smallest representable step instead of a misleading 0.
        frac = ''.padEnd(Math.max(1, maxFraction - 1), '0') + '1';
        return "".concat(neg ? '-' : '', "<0.").concat(frac);
    }
    return "".concat(neg ? '-' : '').concat(grouped).concat(frac ? ".".concat(frac) : '');
}
function fmtCompact(value, decimals) {
    const n = Number((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$amount$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAmount"])(value, decimals));
    if (!Number.isFinite(n)) return fmtAmount(value, decimals);
    const abs = Math.abs(n);
    if (abs < 10_000) return fmtAmount(value, decimals, abs < 1 ? 4 : 2);
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2
    }).format(n);
}
function fmtPct(value) {
    let digits = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 2;
    if (!Number.isFinite(value)) return 'n/a';
    return "".concat(value.toFixed(digits), "%");
}
function fmtScaledPct(value) {
    let digits = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    return "".concat((Number(value) / 10_000).toFixed(digits), "%");
}
function fmtBps(bps) {
    let digits = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    return "".concat((bps / 100).toFixed(digits), "%");
}
function fmtNumber(value) {
    let digits = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 2;
    if (!Number.isFinite(value)) return 'n/a';
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0
    }).format(value);
}
function shortAddress(address) {
    let head = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 4, tail = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 4;
    if (!address) return '';
    if (address.length <= head + tail + 1) return address;
    return "".concat(address.slice(0, head), "...").concat(address.slice(-tail));
}
function runwayDays(balance, perSecond) {
    if (perSecond <= 0n) return null;
    return Number(balance * 1000n / (perSecond * 86_400n)) / 1000;
}
function fmtDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
    if (seconds < 90) return "".concat(Math.ceil(seconds), "s");
    const m = Math.floor(seconds / 60), s = Math.round(seconds % 60);
    if (m < 60) return s ? "".concat(m, "m ").concat(s, "s") : "".concat(m, "m");
    const h = Math.floor(m / 60);
    return "".concat(h, "h ").concat(m % 60, "m");
}
function fmtDate(unixSeconds) {
    const d = new Date(Number(unixSeconds) * 1000);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/Address.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Address",
    ()=>Address,
    "TxLink",
    ()=>TxLink
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/copy.js [app-client] (ecmascript) <export default as Copy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/external-link.js [app-client] (ecmascript) <export default as ExternalLink>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/format.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function explorerUrl(value) {
    if (/^C[A-Z2-7]{55}$/.test(value)) return "".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].explorerUrl, "/contract/").concat(value);
    if (/^G[A-Z2-7]{55}$/.test(value)) return "".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].explorerUrl, "/account/").concat(value);
    return null;
}
function Address(param) {
    let { value, label = 'address', head = 4, tail = 4, explorer = true, className = '' } = param;
    _s();
    const [copied, setCopied] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const url = explorer ? explorerUrl(value) : null;
    const copy = async ()=>{
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(()=>setCopied(false), 1500);
        } catch (e) {}
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "address ".concat(className).trim(),
        title: value,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "address-text",
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["shortAddress"])(value, head, tail)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Address.tsx",
                lineNumber: 22,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "icon-button",
                "aria-label": copied ? "Copied ".concat(label) : "Copy ".concat(label),
                onClick: copy,
                children: copied ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                    size: 13,
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/Address.tsx",
                    lineNumber: 23,
                    columnNumber: 134
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__["Copy"], {
                    size: 13,
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/Address.tsx",
                    lineNumber: 23,
                    columnNumber: 168
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Address.tsx",
                lineNumber: 23,
                columnNumber: 5
            }, this),
            url && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                className: "icon-button",
                href: url,
                target: "_blank",
                rel: "noreferrer",
                "aria-label": "View ".concat(label, " in explorer"),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                    size: 13,
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/Address.tsx",
                    lineNumber: 24,
                    columnNumber: 125
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Address.tsx",
                lineNumber: 24,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Address.tsx",
        lineNumber: 21,
        columnNumber: 10
    }, this);
}
_s(Address, "NE86rL3vg4NVcTTWDavsT0hUBJs=");
_c = Address;
function TxLink(param) {
    let { hash, children, className = 'text-link', ariaLabel } = param;
    if (!hash) return null;
    if (hash.startsWith('mock-')) return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "subtle",
        children: "Demo step"
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Address.tsx",
        lineNumber: 31,
        columnNumber: 40
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
        className: className,
        href: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["transactionUrl"])(hash),
        target: "_blank",
        rel: "noreferrer",
        "aria-label": ariaLabel,
        children: children !== null && children !== void 0 ? children : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$format$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["shortAddress"])(hash, 6, 4),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                    size: 12,
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/Address.tsx",
                    lineNumber: 32,
                    columnNumber: 160
                }, this)
            ]
        }, void 0, true)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Address.tsx",
        lineNumber: 32,
        columnNumber: 10
    }, this);
}
_c1 = TxLink;
var _c, _c1;
__turbopack_context__.k.register(_c, "Address");
__turbopack_context__.k.register(_c1, "TxLink");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/ui/humanize-tx-error.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Turn raw wallet, RPC and contract failures into one plain sentence.
 *
 * Idea adapted from PeridotV2Full 86ae3795 `lib/tx-errors.ts` (`friendlyTxError`) and
 * `lib/errorFormatter.ts`; the patterns are rewritten for Stellar: Soroban host diagnostics,
 * SAC error codes, Peridot core panic strings, Stellar Wallets Kit rejections and the app's own
 * transport messages. Unknown input falls back to the raw message (the toast shows it collapsed). */ __turbopack_context__.s([
    "decodeResultCode",
    ()=>decodeResultCode,
    "describeTxError",
    ()=>describeTxError,
    "humanizeTxError",
    ()=>humanizeTxError,
    "looksRaw",
    ()=>looksRaw,
    "rawMessage",
    ()=>rawMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__ = __turbopack_context__.i("[project]/node_modules/@stellar/stellar-sdk/lib/esm/xdr/index.js [app-client] (ecmascript) <export * as xdr>");
;
function rawMessage(error) {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message || error.name;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
    try {
        return JSON.stringify(error);
    } catch (e) {
        return String(error);
    }
}
const RESULT_CODES = {
    txTooLate: {
        kind: 'expired',
        text: 'The transaction expired before the network included it. Review the action and try again.'
    },
    txTooEarly: {
        kind: 'expired',
        text: 'The transaction time bounds have not started yet. Check your device clock and try again.'
    },
    txInsufficientBalance: {
        kind: 'fee-balance',
        text: 'Your account does not hold enough XLM to pay the network fee and keep its reserve.'
    },
    txInsufficientFee: {
        kind: 'fee',
        text: 'The network fee was too low for the current load. Try again in a few seconds.'
    },
    txBadSeq: {
        kind: 'sequence',
        text: 'Another transaction from this account was submitted first. Refresh and try again.'
    },
    txBadAuth: {
        kind: 'auth',
        text: 'The wallet signature did not match the account. Reconnect your wallet and try again.'
    },
    txBadAuthExtra: {
        kind: 'auth',
        text: 'The transaction carried an unexpected signature. Reconnect your wallet and try again.'
    },
    txNoAccount: {
        kind: 'account',
        text: 'This account does not exist on the selected network yet. Fund it with XLM first.'
    },
    txSorobanInvalid: {
        kind: 'footprint',
        text: 'The simulated resources no longer matched the network state. Try again in a few seconds.'
    },
    txFailed: {
        kind: 'failed',
        text: 'The transaction failed when the network applied it. Refresh balances and try again.'
    },
    txMalformed: {
        kind: 'malformed',
        text: 'The network rejected the transaction as malformed. Refresh the page and review the action again.'
    },
    txInternalError: {
        kind: 'network',
        text: 'The network reported an internal error. Try again in a moment.'
    }
};
function decodeResultCode(message) {
    const match = /Transaction rejected:\s*([A-Za-z0-9+/=]{16,})/.exec(message);
    if (!match) return null;
    try {
        // stellar-sdk 17 decodes unions to `{ type, value }`; older builds expose `result().switch().name`.
        const decoded = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$stellar$2f$stellar$2d$sdk$2f$lib$2f$esm$2f$xdr$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__$2a$__as__xdr$3e$__["xdr"].TransactionResult.fromXDR(match[1], 'base64');
        const result = typeof decoded.result === 'function' ? decoded.result() : decoded.result;
        if (!result) return null;
        if (typeof result.type === 'string') return result.type;
        const code = typeof result.switch === 'function' ? result.switch() : result.switch;
        var _code_name;
        return (_code_name = code === null || code === void 0 ? void 0 : code.name) !== null && _code_name !== void 0 ? _code_name : null;
    } catch (e) {
        return null;
    }
}
/* First match wins. Patterns target raw diagnostics; the app's own sentences pass through untouched. */ const RULES = [
    {
        kind: 'cancelled',
        test: /user (declined|rejected|denied|cancell?ed)|rejected by (the )?user|declined by (the )?user|action rejected|request rejected|user closed/i,
        text: 'You cancelled the request in your wallet. Nothing was submitted.'
    },
    {
        kind: 'popup',
        test: /pop-?up (was )?blocked|blocked (a |the )?pop-?up|window\.open|allow pop-?ups/i,
        text: 'Your browser blocked the wallet window. Allow pop-ups for this site and try again.'
    },
    {
        kind: 'supply-cap',
        test: /supply cap exceeded|supply cap/i,
        text: 'This supply would exceed the market supply cap. Supply a smaller amount or wait until the cap is raised.'
    },
    {
        kind: 'borrow-cap',
        test: /borrow cap exceeded|borrow cap/i,
        text: 'This borrow would exceed the market borrow cap. Borrow a smaller amount or wait until the cap is raised.'
    },
    {
        kind: 'paused',
        test: /(deposit|redeem|borrow|market|vault|withdraw|supply) paused|is paused|\bpaused\b/i,
        text: 'This market is paused by its owner. Try again once it is unpaused.'
    },
    {
        kind: 'stale-boosted',
        test: /boosted health cache (stale|unavailable)|boosted .*stale|stale .*boosted|refresh_boosted_underlying/i,
        text: 'The market yield-route cache is stale. Refresh the market first (Refresh button, then try again in the next ledger).'
    },
    {
        kind: 'footprint',
        test: /exceeded[_ ]limit|ExceededLimit|footprint|ResourceLimitExceeded|resource limit/i,
        text: 'The transaction footprint changed between simulation and submission. Try again in a few seconds.'
    },
    {
        kind: 'trustline',
        test: /trustline entry is missing|trustline (is )?missing|Error\(Contract, #13\)[^]*trustline/i,
        text: 'Your wallet has no trustline for this asset. Add the trustline in your wallet, then try again.'
    },
    {
        kind: 'balance',
        test: /balance is not sufficient|insufficient balance|insufficient funds|insufficient shares|insufficient ptokens|insufficient margin|amount exceeds your/i,
        text: 'Your balance is too low for this amount. Check your wallet and supplied balances, then try a smaller amount.'
    },
    {
        kind: 'collateral',
        test: /insufficient collateral|liquidity shortfall|\bshortfall\b|account liquidity|borrowing power/i,
        text: 'Your collateral does not cover this action. Supply more collateral or reduce the amount.'
    },
    {
        kind: 'liquidity',
        test: /not enough liquidity|insufficient liquidity|market has insufficient liquidity/i,
        text: 'The market does not have enough free liquidity right now. Try a smaller amount or wait for repayments.'
    },
    {
        kind: 'expired',
        test: /txTooLate|too late|expired|time ?bounds? (exceeded|passed)/i,
        text: 'The transaction expired before it was submitted. Review the action and try again.'
    },
    {
        kind: 'rate-limit',
        test: /\b429\b|too many requests|rate limit/i,
        text: 'The network RPC is busy. Wait a few seconds and try again.'
    },
    {
        kind: 'archived',
        test: /archived|restore(d)? (contract|entry|ledger)|must be restored/i,
        text: 'Archived contract data must be restored before this transaction. Try again later or ask the group owner to restore it.'
    },
    {
        kind: 'price',
        test: /stale price|price (is )?stale|price deviation|oracle (price )?(stale|unavailable)|deviation (band|too high)/i,
        text: 'A price feed is stale or deviates too much from the pool. Try again when the oracle has refreshed.'
    },
    {
        kind: 'not-entered',
        test: /market not entered|not entered/i,
        text: 'Enable this market first (a separate transaction), then try again.'
    },
    {
        kind: 'wallet-timeout',
        test: /wallet did not respond|timed out waiting|request timed out/i,
        text: 'The wallet did not respond in time. Close any old wallet window and try again.'
    }
];
function describeTxError(error) {
    const raw = rawMessage(error);
    const code = decodeResultCode(raw);
    if (code && RESULT_CODES[code]) return {
        ...RESULT_CODES[code],
        raw
    };
    if (code) return {
        kind: 'rejected',
        text: "The network rejected the transaction (".concat(code, "). Check balances, limits and permissions, then try again."),
        raw
    };
    for (const rule of RULES)if (rule.test.test(raw)) return {
        kind: rule.kind,
        text: rule.text,
        raw
    };
    return {
        kind: 'raw',
        text: raw,
        raw
    };
}
function humanizeTxError(error) {
    return describeTxError(error).text;
}
function looksRaw(message) {
    return /HostError|Error\(|Diagnostic|Event log|[A-Za-z0-9+/]{40,}={0,2}|[{}[\]]|\bxdr\b|WasmVm|InvalidAction/i.test(message) || message.length > 220;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/Toast.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ToastProvider",
    ()=>ToastProvider,
    "toastFromEvent",
    ()=>toastFromEvent,
    "useRecentTransactions",
    ()=>useRecentTransactions,
    "useToast",
    ()=>useToast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircleAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as CircleAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/octagon-alert.js [app-client] (ecmascript) <export default as OctagonAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PenLine$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pen-line.js [app-client] (ecmascript) <export default as PenLine>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui-events.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$humanize$2d$tx$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui/humanize-tx-error.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui/recent-transactions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Address.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
;
const ToastContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
let adHocCounter = 0;
function storage() {
    try {
        return window.localStorage;
    } catch (e) {
        return null;
    }
}
function toastFromEvent(event) {
    const action = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["methodLabel"])(event.method);
    switch(event.status){
        case 'simulating':
            return {
                id: event.id,
                tone: 'info',
                status: event.status,
                sticky: true,
                title: "".concat(action, ": checking"),
                text: 'Simulating the transaction against the network.'
            };
        case 'signing':
            return {
                id: event.id,
                tone: 'info',
                status: event.status,
                sticky: true,
                title: "".concat(action, ": waiting for your signature"),
                text: 'Review and confirm the transaction in your wallet.'
            };
        case 'submitting':
            return {
                id: event.id,
                tone: 'info',
                status: event.status,
                sticky: true,
                hash: event.hash,
                title: "".concat(action, ": submitting"),
                text: 'Sending the signed transaction to the network.'
            };
        case 'confirming':
            return {
                id: event.id,
                tone: 'info',
                status: event.status,
                sticky: true,
                hash: event.hash,
                title: "".concat(action, ": confirming"),
                text: 'Waiting for the ledger to close. This usually takes a few seconds.'
            };
        case 'success':
            return {
                id: event.id,
                tone: 'success',
                status: event.status,
                hash: event.hash,
                title: "".concat(action, " confirmed"),
                text: event.message || 'The transaction is on chain.'
            };
        case 'unknown':
            return {
                id: event.id,
                tone: 'warn',
                status: event.status,
                sticky: true,
                hash: event.hash,
                title: "".concat(action, ": confirmation unavailable"),
                text: event.message || 'The transaction may still succeed. Check its status before trying again.'
            };
        case 'error':
            {
                const described = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$humanize$2d$tx$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["describeTxError"])(event.message || 'Transaction failed.');
                const showRaw = described.kind !== 'raw' || (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$humanize$2d$tx$2d$error$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["looksRaw"])(described.raw);
                return {
                    id: event.id,
                    tone: 'danger',
                    status: event.status,
                    sticky: true,
                    hash: event.hash,
                    title: "".concat(action, " failed"),
                    text: showRaw && described.kind === 'raw' ? 'The transaction failed. The technical details below say why.' : described.text,
                    raw: showRaw ? described.raw : undefined
                };
            }
    }
}
function ToastProvider(param) {
    let { children } = param;
    _s();
    const [toasts, setToasts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [recent, setRecent] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const recentRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(recent);
    recentRef.current = recent;
    const upsert = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ToastProvider.useCallback[upsert]": (input)=>{
            var _input_id;
            const id = (_input_id = input.id) !== null && _input_id !== void 0 ? _input_id : "toast-".concat(++adHocCounter);
            setToasts({
                "ToastProvider.useCallback[upsert]": (list)=>{
                    const next = {
                        ...input,
                        id,
                        updatedAt: Date.now()
                    };
                    return list.some({
                        "ToastProvider.useCallback[upsert]": (t)=>t.id === id
                    }["ToastProvider.useCallback[upsert]"]) ? list.map({
                        "ToastProvider.useCallback[upsert]": (t)=>t.id === id ? next : t
                    }["ToastProvider.useCallback[upsert]"]) : [
                        ...list,
                        next
                    ].slice(-5);
                }
            }["ToastProvider.useCallback[upsert]"]);
            return id;
        }
    }["ToastProvider.useCallback[upsert]"], []);
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ToastProvider.useCallback[update]": (id, patch)=>{
            setToasts({
                "ToastProvider.useCallback[update]": (list)=>list.map({
                        "ToastProvider.useCallback[update]": (t)=>t.id === id ? {
                                ...t,
                                ...patch,
                                updatedAt: Date.now()
                            } : t
                    }["ToastProvider.useCallback[update]"])
            }["ToastProvider.useCallback[update]"]);
        }
    }["ToastProvider.useCallback[update]"], []);
    const dismiss = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ToastProvider.useCallback[dismiss]": (id)=>setToasts({
                "ToastProvider.useCallback[dismiss]": (list)=>list.filter({
                        "ToastProvider.useCallback[dismiss]": (t)=>t.id !== id
                    }["ToastProvider.useCallback[dismiss]"])
            }["ToastProvider.useCallback[dismiss]"])
    }["ToastProvider.useCallback[dismiss]"], []);
    const clearRecent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ToastProvider.useCallback[clearRecent]": ()=>{
            setRecent([]);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveRecent"])(storage(), __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, []);
        }
    }["ToastProvider.useCallback[clearRecent]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ToastProvider.useEffect": ()=>{
            setRecent((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadRecent"])(storage(), __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name));
        }
    }["ToastProvider.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ToastProvider.useEffect": ()=>{
            const off = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["onTx"])({
                "ToastProvider.useEffect.off": (event)=>{
                    upsert(toastFromEvent(event));
                    const status = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["statusFromTx"])(event.status);
                    if (event.hash && status) {
                        var _event_at;
                        const next = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["upsertRecent"])(recentRef.current, {
                            hash: event.hash,
                            status,
                            at: (_event_at = event.at) !== null && _event_at !== void 0 ? _event_at : Date.now(),
                            method: event.method,
                            contractId: event.contractId
                        });
                        recentRef.current = next;
                        setRecent(next);
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["saveRecent"])(storage(), __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, next);
                    }
                }
            }["ToastProvider.useEffect.off"]);
            // Dev and QA harness only: lets a browser console or Playwright script drive the toasts without a wallet.
            if ("TURBOPACK compile-time truthy", 1) window.__peridotEmitTx = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2d$events$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["emitTx"];
            return off;
        }
    }["ToastProvider.useEffect"], [
        upsert
    ]);
    const api = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "ToastProvider.useMemo[api]": ()=>({
                toasts,
                push: upsert,
                update,
                dismiss,
                recent,
                clearRecent
            })
    }["ToastProvider.useMemo[api]"], [
        toasts,
        upsert,
        update,
        dismiss,
        recent,
        clearRecent
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToastContext.Provider, {
        value: api,
        children: [
            children,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToastViewport, {
                toasts: toasts,
                onDismiss: dismiss
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Toast.tsx",
                lineNumber: 95,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 93,
        columnNumber: 10
    }, this);
}
_s(ToastProvider, "9nhNVDrD0YPz3a2FRDjTl4jlzno=");
_c = ToastProvider;
function useToast() {
    _s1();
    const api = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(ToastContext);
    if (!api) throw new Error('useToast must be used inside ToastProvider.');
    return api;
}
_s1(useToast, "RuQWUboHKlgr1UMOVZMHGcdvr5Q=");
function useRecentTransactions() {
    _s2();
    const api = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(ToastContext);
    if (!api) throw new Error('useRecentTransactions must be used inside ToastProvider.');
    return {
        recent: api.recent,
        clear: api.clearRecent
    };
}
_s2(useRecentTransactions, "RuQWUboHKlgr1UMOVZMHGcdvr5Q=");
const icons = {
    info: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
        size: 18,
        className: "spin",
        "aria-hidden": true
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 112,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    success: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
        size: 18,
        "aria-hidden": true
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 113,
        columnNumber: 12
    }, ("TURBOPACK compile-time value", void 0)),
    warn: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircleAlert$3e$__["CircleAlert"], {
        size: 18,
        "aria-hidden": true
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 114,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0)),
    danger: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonAlert$3e$__["OctagonAlert"], {
        size: 18,
        "aria-hidden": true
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 115,
        columnNumber: 11
    }, ("TURBOPACK compile-time value", void 0))
};
function ToastViewport(param) {
    let { toasts, onDismiss } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "toast-viewport",
        role: "region",
        "aria-live": "polite",
        "aria-label": "Transaction updates",
        children: toasts.map((toast)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToastItem, {
                toast: toast,
                onDismiss: onDismiss
            }, toast.id, false, {
                fileName: "[project]/src/components/ui/Toast.tsx",
                lineNumber: 120,
                columnNumber: 26
            }, this))
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 119,
        columnNumber: 10
    }, this);
}
_c1 = ToastViewport;
function ToastItem(param) {
    let { toast, onDismiss } = param;
    _s3();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ToastItem.useEffect": ()=>{
            if (toast.sticky) return;
            var _toast_ttl;
            const timer = window.setTimeout({
                "ToastItem.useEffect.timer": ()=>onDismiss(toast.id)
            }["ToastItem.useEffect.timer"], (_toast_ttl = toast.ttl) !== null && _toast_ttl !== void 0 ? _toast_ttl : 6000);
            return ({
                "ToastItem.useEffect": ()=>window.clearTimeout(timer)
            })["ToastItem.useEffect"];
        }
    }["ToastItem.useEffect"], [
        toast.id,
        toast.sticky,
        toast.ttl,
        toast.updatedAt,
        onDismiss
    ]);
    const icon = toast.status === 'signing' ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pen$2d$line$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PenLine$3e$__["PenLine"], {
        size: 18,
        "aria-hidden": true
    }, void 0, false, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 130,
        columnNumber: 45
    }, this) : icons[toast.tone];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "toast ".concat(toast.tone),
        role: "status",
        "data-status": toast.status,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "toast-icon",
                children: icon
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Toast.tsx",
                lineNumber: 132,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "toast-main",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "toast-title",
                        children: toast.title
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/Toast.tsx",
                        lineNumber: 134,
                        columnNumber: 7
                    }, this),
                    toast.text && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "toast-text",
                        children: toast.text
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/Toast.tsx",
                        lineNumber: 135,
                        columnNumber: 22
                    }, this),
                    toast.hash && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "toast-meta",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TxLink"], {
                            hash: toast.hash,
                            children: "View on stellar.expert"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/Toast.tsx",
                            lineNumber: 136,
                            columnNumber: 50
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/Toast.tsx",
                        lineNumber: 136,
                        columnNumber: 22
                    }, this),
                    toast.raw && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                                children: "Technical details"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/Toast.tsx",
                                lineNumber: 137,
                                columnNumber: 30
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                                children: toast.raw
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/Toast.tsx",
                                lineNumber: 137,
                                columnNumber: 66
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/Toast.tsx",
                        lineNumber: 137,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/Toast.tsx",
                lineNumber: 133,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "icon-button toast-close",
                "aria-label": "Dismiss ".concat(toast.title),
                onClick: ()=>onDismiss(toast.id),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                    size: 14,
                    "aria-hidden": true
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/Toast.tsx",
                    lineNumber: 139,
                    columnNumber: 137
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/Toast.tsx",
                lineNumber: 139,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/Toast.tsx",
        lineNumber: 131,
        columnNumber: 10
    }, this);
}
_s3(ToastItem, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c2 = ToastItem;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "ToastProvider");
__turbopack_context__.k.register(_c1, "ToastViewport");
__turbopack_context__.k.register(_c2, "ToastItem");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/RecentTransactions.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RecentTransactions",
    ()=>RecentTransactions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$history$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__History$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/history.js [app-client] (ecmascript) <export default as History>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui/recent-transactions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/primitives.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Address.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/Toast.tsx [app-client] (ecmascript)");
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
/* Header popover with the last 10 transaction hashes seen by this browser on the current network.
 * Loosely adapted from PeridotV2Full 86ae3795 components/steallar/TransactionStrip.tsx; the backend
 * query, demo rows and points are gone, the source is the local event bus and localStorage only. */ const statusCopy = {
    pending: {
        label: 'Pending',
        tone: 'info'
    },
    success: {
        label: 'Confirmed',
        tone: 'success'
    },
    failed: {
        label: 'Failed',
        tone: 'danger'
    },
    unknown: {
        label: 'Unconfirmed',
        tone: 'warn'
    }
};
function RecentTransactions() {
    _s();
    const { recent, clear } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRecentTransactions"])();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const root = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RecentTransactions.useEffect": ()=>{
            if (!open) return;
            const onPointer = {
                "RecentTransactions.useEffect.onPointer": (event)=>{
                    if (root.current && !root.current.contains(event.target)) setOpen(false);
                }
            }["RecentTransactions.useEffect.onPointer"];
            const onKey = {
                "RecentTransactions.useEffect.onKey": (event)=>{
                    if (event.key === 'Escape') setOpen(false);
                }
            }["RecentTransactions.useEffect.onKey"];
            document.addEventListener('mousedown', onPointer);
            document.addEventListener('touchstart', onPointer);
            document.addEventListener('keydown', onKey);
            return ({
                "RecentTransactions.useEffect": ()=>{
                    document.removeEventListener('mousedown', onPointer);
                    document.removeEventListener('touchstart', onPointer);
                    document.removeEventListener('keydown', onKey);
                }
            })["RecentTransactions.useEffect"];
        }
    }["RecentTransactions.useEffect"], [
        open
    ]);
    const pending = recent.filter((tx)=>tx.status === 'pending').length;
    const label = recent.length === 0 ? 'Recent transactions' : "Recent transactions (".concat(recent.length).concat(pending ? ", ".concat(pending, " pending") : '', ")");
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "recent-tx",
        ref: root,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: "recent-tx-button",
                "aria-label": label,
                title: label,
                "aria-expanded": open,
                "aria-haspopup": "dialog",
                onClick: ()=>setOpen((value)=>!value),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$history$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__History$3e$__["History"], {
                        size: 16,
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                        lineNumber: 38,
                        columnNumber: 7
                    }, this),
                    recent.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "recent-tx-count".concat(pending ? ' pending' : ''),
                        "aria-hidden": true,
                        children: recent.length
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                        lineNumber: 39,
                        columnNumber: 29
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                lineNumber: 37,
                columnNumber: 5
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "recent-tx-panel",
                role: "dialog",
                "aria-label": "Recent transactions",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "recent-tx-head",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                children: "Recent transactions"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                lineNumber: 42,
                                columnNumber: 39
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "subtle",
                                style: {
                                    fontSize: 12
                                },
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                lineNumber: 42,
                                columnNumber: 75
                            }, this),
                            recent.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "button",
                                className: "button quiet sm",
                                onClick: clear,
                                children: "Clear"
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                lineNumber: 42,
                                columnNumber: 168
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                        lineNumber: 42,
                        columnNumber: 7
                    }, this),
                    recent.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "muted",
                        children: [
                            "No transactions from this browser on ",
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name,
                            " yet. Submitted, confirmed and failed transactions appear here with explorer links."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                        lineNumber: 44,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "recent-tx-list",
                        children: recent.map((tx)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "cell-main",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["methodLabel"])(tx.method)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                                lineNumber: 46,
                                                columnNumber: 16
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "recent-tx-sub",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$primitives$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                        tone: statusCopy[tx.status].tone,
                                                        children: statusCopy[tx.status].label
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                                        lineNumber: 46,
                                                        columnNumber: 107
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["relativeTime"])(tx.at)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                                        lineNumber: 46,
                                                        columnNumber: 185
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                                lineNumber: 46,
                                                columnNumber: 75
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                        lineNumber: 46,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Address$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TxLink"], {
                                        hash: tx.hash,
                                        ariaLabel: "View ".concat((0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$recent$2d$transactions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["methodLabel"])(tx.method), " transaction in explorer")
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                        lineNumber: 47,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, tx.hash, true, {
                                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                                lineNumber: 45,
                                columnNumber: 60
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                        lineNumber: 45,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/RecentTransactions.tsx",
                lineNumber: 41,
                columnNumber: 14
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/RecentTransactions.tsx",
        lineNumber: 36,
        columnNumber: 10
    }, this);
}
_s(RecentTransactions, "/pKyundsGuAAYnGm4B4vOSiDaKk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRecentTransactions"]
    ];
});
_c = RecentTransactions;
var _c;
__turbopack_context__.k.register(_c, "RecentTransactions");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/AppShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppShell",
    ()=>AppShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUpRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-up-right.js [app-client] (ecmascript) <export default as ArrowUpRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-down.js [app-client] (ecmascript) <export default as ChevronDown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eye.js [app-client] (ecmascript) <export default as Eye>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flask$2d$conical$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FlaskConical$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/flask-conical.js [app-client] (ecmascript) <export default as FlaskConical>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-alert.js [app-client] (ecmascript) <export default as ShieldAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wallet.js [app-client] (ecmascript) <export default as Wallet>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/network.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/wallet.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/peridot/rpc.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ThemeToggle$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/ThemeToggle.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$RecentTransactions$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/RecentTransactions.tsx [app-client] (ecmascript)");
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
/* Presentation-only shell. Wallet, network and recovery behaviour are the same calls as
 * components/peridot/AppShell.tsx; only the markup, badges and theme toggle differ. */ const links = [
    {
        href: '/groups',
        label: 'Explore',
        match: (p)=>p.startsWith('/groups')
    },
    {
        href: '/launch',
        label: 'Launch',
        match: (p)=>p === '/launch'
    },
    {
        href: '/vaults',
        label: 'Vaults',
        match: (p)=>p.startsWith('/vaults')
    },
    {
        href: '/tokens',
        label: 'Launchpad',
        match: (p)=>p.startsWith('/tokens') || p.startsWith('/token/') || p === '/launch-token'
    },
    {
        href: '/about',
        label: 'How it works',
        match: (p)=>p === '/about'
    }
];
function AppShell(param) {
    let { children } = param;
    _s();
    const wallet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWallet"])();
    const path = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const [recovery, setRecovery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const bannerText = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'Demo data. No funds move and no wallet signatures are requested.' : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].readOnly ? 'Read-only preview. Transactions are not enabled.' : 'Beta. New contracts are unaudited. Caps apply.';
    const BannerIcon = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$flask$2d$conical$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FlaskConical$3e$__["FlaskConical"] : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].readOnly ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eye$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eye$3e$__["Eye"] : __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__["ShieldAlert"];
    const networkLabel = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'Demo' : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name === 'mainnet' ? 'Mainnet beta' : 'Testnet';
    const nav = links.map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
            className: l.match(path) ? 'active' : '',
            href: l.href,
            "aria-current": l.match(path) ? 'page' : undefined,
            children: l.label
        }, l.href, false, {
            fileName: "[project]/src/components/ui/AppShell.tsx",
            lineNumber: 29,
            columnNumber: 30
        }, this));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "shell",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "network-banner".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? ' demo' : ''),
                role: "note",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BannerIcon, {
                        size: 14,
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/AppShell.tsx",
                        lineNumber: 31,
                        columnNumber: 85
                    }, this),
                    bannerText
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/AppShell.tsx",
                lineNumber: 31,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "site-header",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "site-header-inner",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/",
                            className: "wordmark",
                            "aria-label": "Peridot Markets home",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                    src: "/logo-optimized.svg",
                                    alt: "",
                                    width: "26",
                                    height: "30"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 34,
                                    columnNumber: 79
                                }, this),
                                "peridot",
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "markets"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 34,
                                    columnNumber: 149
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 34,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                            className: "site-nav",
                            "aria-label": "Main navigation",
                            children: nav
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 35,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "header-actions",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "badge accent",
                                    title: "Network: ".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "live-dot",
                                            "aria-hidden": true
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/AppShell.tsx",
                                            lineNumber: 37,
                                            columnNumber: 77
                                        }, this),
                                        networkLabel
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 37,
                                    columnNumber: 11
                                }, this),
                                !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                    "aria-label": "Wallet provider",
                                    value: wallet.walletId,
                                    disabled: wallet.isConnecting || !!wallet.address,
                                    onChange: (e)=>wallet.selectWallet(e.target.value),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "albedo",
                                            children: "Albedo"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/AppShell.tsx",
                                            lineNumber: 38,
                                            columnNumber: 223
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                            value: "freighter",
                                            children: "Freighter"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/AppShell.tsx",
                                            lineNumber: 38,
                                            columnNumber: 261
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 38,
                                    columnNumber: 33
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "button wallet-button".concat(wallet.address ? ' connected' : ''),
                                    disabled: wallet.isConnecting || !wallet.isReady && !wallet.error,
                                    onClick: ()=>wallet.address ? wallet.disconnect() : void wallet.connect(),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wallet$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wallet$3e$__["Wallet"], {
                                            size: 15,
                                            "aria-hidden": true
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/AppShell.tsx",
                                            lineNumber: 40,
                                            columnNumber: 13
                                        }, this),
                                        wallet.address ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks ? 'Demo account' : "".concat(wallet.address.slice(0, 4), "…").concat(wallet.address.slice(-4)) : wallet.isConnecting ? 'Connecting' : !wallet.isReady && !wallet.error ? 'Loading wallet...' : 'Connect wallet',
                                        wallet.address && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$down$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronDown$3e$__["ChevronDown"], {
                                            size: 13,
                                            "aria-hidden": true
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/AppShell.tsx",
                                            lineNumber: 42,
                                            columnNumber: 32
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 39,
                                    columnNumber: 11
                                }, this),
                                wallet.isConnecting && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "button ghost",
                                    onClick: wallet.disconnect,
                                    children: "Cancel"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 44,
                                    columnNumber: 35
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$ThemeToggle$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThemeToggle"], {}, void 0, false, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 45,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$RecentTransactions$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RecentTransactions"], {}, void 0, false, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 46,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 36,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/AppShell.tsx",
                    lineNumber: 33,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/AppShell.tsx",
                lineNumber: 32,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                className: "mobile-nav",
                "aria-label": "Main navigation (mobile)",
                children: [
                    nav,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "badge accent",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "live-dot",
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/AppShell.tsx",
                                lineNumber: 50,
                                columnNumber: 107
                            }, this),
                            networkLabel
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/ui/AppShell.tsx",
                        lineNumber: 50,
                        columnNumber: 76
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/ui/AppShell.tsx",
                lineNumber: 50,
                columnNumber: 5
            }, this),
            (wallet.error || wallet.networkMismatch) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "wallet-alert",
                role: "alert",
                children: wallet.error || "Switch your wallet to ".concat(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].name, " before signing, then return to this page. If this message stays, disconnect and connect again.")
            }, void 0, false, {
                fileName: "[project]/src/components/ui/AppShell.tsx",
                lineNumber: 51,
                columnNumber: 50
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "site-main",
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/ui/AppShell.tsx",
                lineNumber: 52,
                columnNumber: 5
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                className: "site-footer",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "site-footer-inner",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "Built on Stellar. Composed with Reflector, DeFindex, Blend and Aquarius."
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 55,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/about",
                                    children: [
                                        "Prior work and architecture ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$up$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowUpRight$3e$__["ArrowUpRight"], {
                                            size: 13,
                                            "aria-hidden": true
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/AppShell.tsx",
                                            lineNumber: 57,
                                            columnNumber: 59
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 57,
                                    columnNumber: 11
                                }, this),
                                wallet.address && !__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$network$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["network"].useMocks && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>void (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$rpc$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["reconcilePendingTransaction"])(wallet.address).then((s)=>setRecovery("Previous transaction: ".concat(s, ". Refresh the current page before continuing."))).catch((e)=>setRecovery(e.message)),
                                    children: "Check pending transaction"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/AppShell.tsx",
                                    lineNumber: 58,
                                    columnNumber: 51
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 56,
                            columnNumber: 9
                        }, this),
                        recovery && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            role: "status",
                            children: recovery
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 60,
                            columnNumber: 22
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "Beta. New contracts are unaudited. Caps apply. Core lending contracts are Peridot's audited contracts with 60 second timelocks."
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/AppShell.tsx",
                            lineNumber: 61,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/AppShell.tsx",
                    lineNumber: 54,
                    columnNumber: 7
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/ui/AppShell.tsx",
                lineNumber: 53,
                columnNumber: 5
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/AppShell.tsx",
        lineNumber: 30,
        columnNumber: 10
    }, this);
}
_s(AppShell, "j8V+YGbHI58a/M9TmLzVFGUUUA0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$peridot$2f$wallet$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useWallet"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c = AppShell;
var _c;
__turbopack_context__.k.register(_c, "AppShell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/ErrorBoundary.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ErrorBoundary",
    ()=>ErrorBoundary,
    "ErrorCard",
    ()=>ErrorCard,
    "PageErrorBoundary",
    ()=>PageErrorBoundary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@swc/helpers/esm/_define_property.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/octagon-alert.js [app-client] (ecmascript) <export default as OctagonAlert>");
;
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function ErrorCard(param) {
    let { error, onRetry, title = 'Something went wrong', children } = param;
    const detail = "".concat(error.name || 'Error', ": ").concat(error.message || 'No message.').concat(error.digest ? "\nDigest: ".concat(error.digest) : '');
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "page",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
            className: "card error-card",
            role: "alert",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "error-icon",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$octagon$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__OctagonAlert$3e$__["OctagonAlert"], {
                        size: 22,
                        "aria-hidden": true
                    }, void 0, false, {
                        fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                        lineNumber: 16,
                        columnNumber: 36
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                    lineNumber: 16,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    children: title
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                    lineNumber: 17,
                    columnNumber: 7
                }, this),
                children !== null && children !== void 0 ? children : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: "This part of the page hit an unexpected error. Your wallet and any confirmed transactions are not affected. Try again, or reload the page if it keeps happening."
                }, void 0, false, {
                    fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                    lineNumber: 18,
                    columnNumber: 20
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "row",
                    children: [
                        onRetry && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: "button",
                            onClick: onRetry,
                            children: "Try again"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                            lineNumber: 20,
                            columnNumber: 21
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: "button secondary",
                            onClick: ()=>window.location.reload(),
                            children: "Reload"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                            lineNumber: 21,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            className: "button ghost",
                            href: "/",
                            children: "Home"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                            lineNumber: 22,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                    lineNumber: 19,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("details", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("summary", {
                            children: "Technical details"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                            lineNumber: 24,
                            columnNumber: 16
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("pre", {
                            children: detail
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                            lineNumber: 24,
                            columnNumber: 52
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
                    lineNumber: 24,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
            lineNumber: 15,
            columnNumber: 5
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
        lineNumber: 14,
        columnNumber: 10
    }, this);
}
_c = ErrorCard;
class ErrorBoundary extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Component"] {
    static getDerivedStateFromError(error) {
        return {
            error
        };
    }
    componentDidCatch(error, info) {
        if ("TURBOPACK compile-time truthy", 1) console.error('[ErrorBoundary]', error, info.componentStack);
    }
    render() {
        if (!this.state.error) return this.props.children;
        return this.props.fallback ? this.props.fallback(this.state.error, this.reset) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ErrorCard, {
            error: this.state.error,
            onRetry: this.reset
        }, void 0, false, {
            fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
            lineNumber: 41,
            columnNumber: 86
        }, this);
    }
    constructor(...args){
        super(...args), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "state", {
            error: null
        }), (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$swc$2f$helpers$2f$esm$2f$_define_property$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["_"])(this, "reset", ()=>this.setState({
                error: null
            }));
    }
}
function PageErrorBoundary(param) {
    let { children } = param;
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ErrorBoundary, {
        children: children
    }, pathname, false, {
        fileName: "[project]/src/components/ui/ErrorBoundary.tsx",
        lineNumber: 48,
        columnNumber: 10
    }, this);
}
_s(PageErrorBoundary, "xbyQPtUVMO7MNj7WjJlpdWqRcTo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c1 = PageErrorBoundary;
var _c, _c1;
__turbopack_context__.k.register(_c, "ErrorCard");
__turbopack_context__.k.register(_c1, "PageErrorBoundary");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/ui/risk-disclaimer.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Persistence rules for the one-time risk disclaimer.
 *
 * Adapted from PeridotV2Full 86ae3795 `components/RiskDisclaimerModal.tsx` (its localStorage flag
 * `peridot-risk-disclaimer-acknowledged` = 'true'). Changes: the stored value is the disclaimer
 * version, so editing the text re-shows the dialog; storage access is injected for unit tests. */ __turbopack_context__.s([
    "DISCLAIMER_KEY",
    ()=>DISCLAIMER_KEY,
    "DISCLAIMER_VERSION",
    ()=>DISCLAIMER_VERSION,
    "acknowledge",
    ()=>acknowledge,
    "disclaimerPreAcceptScript",
    ()=>disclaimerPreAcceptScript,
    "hasAcknowledged",
    ()=>hasAcknowledged
]);
const DISCLAIMER_KEY = 'peridot:risk-ack';
const DISCLAIMER_VERSION = '2026-10-26';
function hasAcknowledged(storage) {
    let version = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : DISCLAIMER_VERSION;
    if (!storage) return false;
    try {
        return storage.getItem(DISCLAIMER_KEY) === version;
    } catch (e) {
        return false;
    }
}
function acknowledge(storage) {
    let version = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : DISCLAIMER_VERSION;
    if (!storage) return false;
    try {
        storage.setItem(DISCLAIMER_KEY, version);
        return true;
    } catch (e) {
        return false;
    }
}
const disclaimerPreAcceptScript = "try{localStorage.setItem('".concat(DISCLAIMER_KEY, "','").concat(DISCLAIMER_VERSION, "')}catch(e){}");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/RiskDisclaimer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RiskDisclaimer",
    ()=>RiskDisclaimer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-alert.js [app-client] (ecmascript) <export default as ShieldAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$risk$2d$disclaimer$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/ui/risk-disclaimer.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
/* One-time risk disclaimer. Adapted from PeridotV2Full 86ae3795 components/RiskDisclaimerModal.tsx:
 * same idea (modal, checkbox gate, localStorage flag) with the EVM wallet gate, click-outside and
 * Escape dismissal removed (acceptance is the only way out), a focus trap added and the text written
 * for Peridot Markets on Stellar. Renders nothing on the server and opens from an effect, so there is
 * no hydration mismatch. Storage key and version live in lib/ui/risk-disclaimer.ts. */ function storage() {
    try {
        return window.localStorage;
    } catch (e) {
        return null;
    }
}
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function RiskDisclaimer() {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [checked, setChecked] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const dialogRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const titleId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])(), descId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])(), checkId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RiskDisclaimer.useEffect": ()=>{
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$risk$2d$disclaimer$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasAcknowledged"])(storage())) setOpen(true);
        }
    }["RiskDisclaimer.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RiskDisclaimer.useEffect": ()=>{
            var _dialogRef_current;
            if (!open) return;
            const previous = document.activeElement;
            const bodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            (_dialogRef_current = dialogRef.current) === null || _dialogRef_current === void 0 ? void 0 : _dialogRef_current.focus();
            const onKeyDown = {
                "RiskDisclaimer.useEffect.onKeyDown": (event)=>{
                    const dialog = dialogRef.current;
                    if (!dialog) return;
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                    }
                    if (event.key !== 'Tab') return;
                    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));
                    if (focusable.length === 0) {
                        event.preventDefault();
                        return;
                    }
                    const first = focusable[0], last = focusable[focusable.length - 1], current = document.activeElement;
                    if (!dialog.contains(current)) {
                        event.preventDefault();
                        first.focus();
                        return;
                    }
                    if (event.shiftKey && (current === first || current === dialog)) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && current === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            }["RiskDisclaimer.useEffect.onKeyDown"];
            const onFocusIn = {
                "RiskDisclaimer.useEffect.onFocusIn": (event)=>{
                    if (dialogRef.current && !dialogRef.current.contains(event.target)) dialogRef.current.focus();
                }
            }["RiskDisclaimer.useEffect.onFocusIn"];
            document.addEventListener('keydown', onKeyDown, true);
            document.addEventListener('focusin', onFocusIn);
            return ({
                "RiskDisclaimer.useEffect": ()=>{
                    var _previous_focus;
                    document.removeEventListener('keydown', onKeyDown, true);
                    document.removeEventListener('focusin', onFocusIn);
                    document.body.style.overflow = bodyOverflow;
                    previous === null || previous === void 0 ? void 0 : (_previous_focus = previous.focus) === null || _previous_focus === void 0 ? void 0 : _previous_focus.call(previous);
                }
            })["RiskDisclaimer.useEffect"];
        }
    }["RiskDisclaimer.useEffect"], [
        open
    ]);
    if (!open) return null;
    const accept = ()=>{
        if (!checked) return;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$ui$2f$risk$2d$disclaimer$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["acknowledge"])(storage()); // A storage failure only means the dialog returns on the next visit.
        setOpen(false);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "disclaimer-backdrop",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            ref: dialogRef,
            className: "disclaimer",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": titleId,
            "aria-describedby": descId,
            tabIndex: -1,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                    className: "disclaimer-head",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "disclaimer-icon",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__["ShieldAlert"], {
                                size: 20,
                                "aria-hidden": true
                            }, void 0, false, {
                                fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                lineNumber: 67,
                                columnNumber: 43
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 67,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "eyebrow",
                                    children: "Before you continue"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 68,
                                    columnNumber: 14
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    id: titleId,
                                    children: "Peridot Markets is a beta"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 68,
                                    columnNumber: 60
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 68,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                    lineNumber: 66,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "disclaimer-body",
                    id: descId,
                    tabIndex: 0,
                    "aria-label": "Risk disclaimer text",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "Please read this once. It explains what you are using and what can go wrong."
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 71,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            children: "What this is"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 72,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Beta software."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 74,
                                            columnNumber: 15
                                        }, this),
                                        " Peridot Markets runs on Stellar mainnet as a beta. The new contracts (market factory, margin, yield adapters and launchpad) are unaudited, and supply and borrow caps apply."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 74,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Audited core."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 75,
                                            columnNumber: 15
                                        }, this),
                                        " The core lending contracts are Peridot's audited contracts. Owner and admin parameter changes wait behind 60 second timelocks."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 75,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Isolated groups."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 76,
                                            columnNumber: 15
                                        }, this),
                                        " Each market group is isolated from the others. Its owner configures risk settings, price sources and yield routes. Check who owns a group before you use it."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 76,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 73,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            children: "What can go wrong"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 78,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Liquidation."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 80,
                                            columnNumber: 15
                                        }, this),
                                        " A borrowing account can be liquidated when its debt exceeds the value of its enabled collateral times the collateral factor."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 80,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Leverage."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 81,
                                            columnNumber: 15
                                        }, this),
                                        " A leveraged position can lose the whole margin. Fees and slippage reduce what comes back."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 81,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Prices, pools and routes."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 82,
                                            columnNumber: 15
                                        }, this),
                                        " Price feeds can go stale, pools can move against you and yield routes can pause or lose value."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 82,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Launchpad tokens."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 83,
                                            columnNumber: 15
                                        }, this),
                                        " Tokens launched on the testnet launchpad are experiments. They have no value and no promise of one."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 83,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("strong", {
                                            children: "Loss of funds."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                            lineNumber: 84,
                                            columnNumber: 15
                                        }, this),
                                        " Smart contracts can contain bugs. You may lose some or all of the funds you use here."
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 84,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 79,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            children: "Your responsibility"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 86,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: "Nothing on this site is financial advice. Peridot Markets does not recommend any asset, group or strategy. You decide what to do, you review every transaction in your wallet before you sign it, and you should not use funds you cannot afford to lose."
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 87,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                    lineNumber: 70,
                    columnNumber: 7
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
                    className: "disclaimer-foot",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "check",
                            htmlFor: checkId,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    id: checkId,
                                    type: "checkbox",
                                    checked: checked,
                                    onChange: (event)=>setChecked(event.target.checked)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 91,
                                    columnNumber: 11
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    children: "I understand the risks and I accept them."
                                }, void 0, false, {
                                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                                    lineNumber: 92,
                                    columnNumber: 11
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 90,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            className: "button block",
                            disabled: !checked,
                            onClick: accept,
                            children: "Accept and continue"
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 94,
                            columnNumber: 9
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "field-hint",
                            children: "Shown once per browser. It returns when this text changes."
                        }, void 0, false, {
                            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                            lineNumber: 95,
                            columnNumber: 9
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
                    lineNumber: 89,
                    columnNumber: 7
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
            lineNumber: 65,
            columnNumber: 5
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/RiskDisclaimer.tsx",
        lineNumber: 64,
        columnNumber: 10
    }, this);
}
_s(RiskDisclaimer, "vbkPwsFKF5CGMv5yz2dsUoMAysg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useId"]
    ];
});
_c = RiskDisclaimer;
var _c;
__turbopack_context__.k.register(_c, "RiskDisclaimer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_d65e81a1._.js.map