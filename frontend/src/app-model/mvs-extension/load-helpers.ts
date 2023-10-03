/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import { Mat3, Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureComponentParams } from 'molstar/lib/mol-plugin-state/helpers/structure-component';
import { StructureFromModel } from 'molstar/lib/mol-plugin-state/transforms/model';
import { StructureRepresentation3D } from 'molstar/lib/mol-plugin-state/transforms/representation';
import { StateBuilder, StateObjectSelector, StateTransformer } from 'molstar/lib/mol-state';

import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { AnnotationColorThemeProps, AnnotationColorThemeProvider } from './additions/annotation-color-theme';
import { AnnotationLabelRepresentationProvider } from './additions/annotation-label/representation';
import { AnnotationSpec } from './additions/annotation-prop';
import { AnnotationStructureComponentProps } from './additions/annotation-structure-component';
import { AnnotationTooltipsProps } from './additions/annotation-tooltips-prop';
import { CustomTooltipsProps } from './additions/custom-tooltips-prop';
import { MultilayerColorThemeName, MultilayerColorThemeProps, NoColor, SelectorAll } from './additions/multilayer-color-theme';
import { rowToExpression, rowsToExpression } from './helpers/selections';
import { MolstarLoadingContext } from './load';
import { Kind, ParamsOfKind, SubTree, SubTreeOfKind, Tree, getChildren, getParams } from './tree/generic/generic';
import { dfs } from './tree/generic/tree-utils';
import { MolstarKind, MolstarNode, MolstarTree } from './tree/mvs/molstar-tree';
import { DefaultColor, Defaults } from './tree/mvs/param-defaults';
import { ElementOfSet, canonicalJsonString, decodeColor, distinct, isDefined, stringHash } from './utils';


export type LoadingAction<TNode extends Tree, TContext> = (update: StateBuilder.Root, msTarget: StateObjectSelector, node: TNode, context: TContext) => StateObjectSelector | undefined

export type LoadingActions<TTree extends Tree, TContext> = { [kind in Kind<SubTree<TTree>>]?: LoadingAction<SubTreeOfKind<TTree, kind>, TContext> }

export async function loadTree<TTree extends Tree, TContext>(plugin: PluginContext, tree: TTree, loadingActions: LoadingActions<TTree, TContext>, context: TContext, deletePrevious: boolean) {
    const mapping = new Map<SubTree<TTree>, StateObjectSelector | undefined>();
    const update = plugin.build();
    const msRoot = update.toRoot().selector;
    if (deletePrevious) {
        update.currentTree.children.get(msRoot.ref).forEach(child => update.delete(child));
    }
    dfs<TTree>(tree, (node, parent) => {
        const kind: Kind<typeof node> = node.kind;
        const action = loadingActions[kind] as LoadingAction<typeof node, TContext> | undefined;
        if (action) {
            const msTarget = parent ? mapping.get(parent) : msRoot;
            if (msTarget) {
                const msNode = action(update, msTarget, node, context);
                mapping.set(node, msNode);
            } else {
                console.warn(`No target found for this "${node.kind}" node`);
                return;
            }
        }
    });
    await update.commit();
}


export const AnnotationFromUriKinds = new Set(['color_from_uri', 'component_from_uri', 'label_from_uri', 'tooltip_from_uri'] satisfies MolstarKind[]);
export type AnnotationFromUriKind = ElementOfSet<typeof AnnotationFromUriKinds>

export const AnnotationFromSourceKinds = new Set(['color_from_source', 'component_from_source', 'label_from_source', 'tooltip_from_source'] satisfies MolstarKind[]);
export type AnnotationFromSourceKind = ElementOfSet<typeof AnnotationFromSourceKinds>


/** Return a 4x4 matrix representing rotation + translation */
export function transformFromRotationTranslation(rotation: number[] | null | undefined, translation: number[] | null | undefined): Mat4 {
    if (rotation && rotation.length !== 9) throw new Error(`'rotation' param for 'transform' node must be array of 9 elements, found ${rotation}`);
    if (translation && translation.length !== 3) throw new Error(`'translation' param for 'transform' node must be array of 3 elements, found ${translation}`);
    const T = Mat4.identity();
    if (rotation) {
        Mat4.fromMat3(T, Mat3.fromArray(Mat3(), rotation, 0));
    }
    if (translation) {
        Mat4.setTranslation(T, Vec3.fromArray(Vec3(), translation, 0));
    }
    if (!Mat4.isRotationAndTranslation(T)) throw new Error(`'rotation' param for 'transform' is not a valid rotation matrix: ${rotation}`);
    return T;
}

/** Collect distinct annotation specs from all nodes in `tree` and set context.annotationMap[node] to respective annotationIds */
export function collectAnnotationReferences(tree: SubTree<MolstarTree>, context: MolstarLoadingContext): AnnotationSpec[] {
    const distinctSpecs: { [key: string]: AnnotationSpec } = {};
    dfs(tree, node => {
        let spec: Omit<AnnotationSpec, 'id'> | undefined = undefined;
        if (AnnotationFromUriKinds.has(node.kind as any)) {
            const p = (node as MolstarNode<AnnotationFromUriKind>).params;
            spec = { source: { name: 'url', params: { url: p.url, format: p.format } }, schema: p.schema, cifBlock: blockSpec(p.block_header, p.block_index), cifCategory: p.category_name ?? undefined };
        } else if (AnnotationFromSourceKinds.has(node.kind as any)) {
            const p = (node as MolstarNode<AnnotationFromSourceKind>).params;
            spec = { source: { name: 'source-cif', params: {} }, schema: p.schema, cifBlock: blockSpec(p.block_header, p.block_index), cifCategory: p.category_name ?? undefined };
        }
        if (spec) {
            const key = canonicalJsonString(spec as any);
            distinctSpecs[key] ??= { ...spec, id: stringHash(key) };
            (context.annotationMap ??= new Map()).set(node, distinctSpecs[key].id);
        }
    });
    return Object.values(distinctSpecs);
}
function blockSpec(header: string | null | undefined, index: number | null | undefined): AnnotationSpec['cifBlock'] {
    if (isDefined(header)) {
        return { name: 'header', params: { header: header } };
    } else {
        return { name: 'index', params: { index: index ?? 0 } };
    }
}

export function collectAnnotationTooltips(tree: SubTreeOfKind<MolstarTree, 'structure'>, context: MolstarLoadingContext) {
    const annotationTooltips: AnnotationTooltipsProps['tooltips'] = [];
    dfs(tree, node => {
        if (node.kind === 'tooltip_from_uri' || node.kind === 'tooltip_from_source') {
            const annotationId = context.annotationMap?.get(node);
            if (annotationId) {
                annotationTooltips.push({ annotationId, fieldName: node.params.field_name ?? Defaults[node.kind].field_name });
            };
        }
    });
    return distinct(annotationTooltips);
}
export function collectInlineTooltips(tree: SubTreeOfKind<MolstarTree, 'structure'>, context: MolstarLoadingContext) {
    const inlineTooltips: CustomTooltipsProps['tooltips'] = [];
    dfs(tree, (node, parent) => {
        if (node.kind === 'tooltip') {
            if (parent?.kind === 'component') {
                // TODO what about nested components?! (do we want to allow them?) (would require changes here (process spine instead of parent) and in CustomTooltips)
                inlineTooltips.push({
                    text: node.params.text,
                    selector: componentPropsFromSelector(parent.params.selector),
                });
            } else if (parent?.kind === 'component_from_uri' || parent?.kind === 'component_from_source') {
                const p = componentFromUrlOrCifProps(parent, context);
                if (isDefined(p.annotationId) && isDefined(p.fieldName) && isDefined(p.fieldValues)) {
                    inlineTooltips.push({
                        text: node.params.text,
                        selector: {
                            name: 'annotation',
                            params: { annotationId: p.annotationId, fieldName: p.fieldName, fieldValues: p.fieldValues },
                        },
                    });
                }
            }
        }
    });
    return inlineTooltips;
}

/** Return `true` for components nodes which only serve for tooltip placement (not to be created in the MolStar object hierarchy) */
export function isPhantomComponent(node: SubTreeOfKind<MolstarTree, 'component' | 'component_from_uri' | 'component_from_source'>) {
    // return false;
    return node.children && node.children.every(child => child.kind === 'tooltip' || child.kind === 'tooltip_from_uri' || child.kind === 'tooltip_from_source');
    // These nodes could theoretically be removed when converting MVS to Molstar tree, but would get very tricky if we allow nested components
}

export function structureProps(node: MolstarNode<'structure'>): StateTransformer.Params<StructureFromModel> {
    const params = getParams(node);
    switch (params.kind) {
        case 'model':
            return {
                type: {
                    name: 'model',
                    params: {}
                }
            };
        case 'assembly':
            return {
                type: {
                    name: 'assembly',
                    params: { id: params.assembly_id }
                },
            };
        case 'symmetry':
            return {
                type: {
                    name: 'symmetry',
                    params: { ijkMin: params.ijk_min ?? Defaults.structure.ijk_min, ijkMax: params.ijk_max ?? Defaults.structure.ijk_max }
                },
            };
        case 'symmetry_mates':
            return {
                type: {
                    name: 'symmetry-mates',
                    params: { radius: params.radius ?? Defaults.structure.radius }
                }
            };
        default:
            throw new Error(`NotImplementedError: Loading action for "structure" node, kind "${params.kind}"`);
    }
}

export function componentPropsFromSelector(selector?: ParamsOfKind<MolstarTree, 'component'>['selector']): StructureComponentParams['type'] {
    if (selector === undefined) {
        return SelectorAll;
    } else if (typeof selector === 'string') {
        return { name: 'static', params: selector };
    } else if (Array.isArray(selector)) {
        return { name: 'expression', params: rowsToExpression(selector) };
    } else {
        return { name: 'expression', params: rowToExpression(selector) };
    }
}

export function labelFromUrlOrCifProps(node: MolstarNode<'label_from_uri' | 'label_from_source'>, context: MolstarLoadingContext): Partial<StateTransformer.Params<StructureRepresentation3D>> {
    const annotationId = context.annotationMap?.get(node);
    const fieldName = node.params.field_name ?? Defaults[node.kind].field_name;
    const nearestReprNode = context.nearestReprMap?.get(node);
    return {
        type: { name: AnnotationLabelRepresentationProvider.name, params: { annotationId, fieldName } },
        colorTheme: colorThemeForNode(nearestReprNode, context),
    };
}

export function componentFromUrlOrCifProps(node: MolstarNode<'component_from_uri' | 'component_from_source'>, context: MolstarLoadingContext): Partial<AnnotationStructureComponentProps> {
    const annotationId = context.annotationMap?.get(node);
    const { field_name, field_values } = node.params;
    return {
        annotationId,
        fieldName: field_name ?? Defaults[node.kind].field_name,
        fieldValues: field_values ? { name: 'selected', params: field_values.map(v => ({ value: v })) } : { name: 'all', params: {} },
        nullIfEmpty: false,
    };
}

export function colorThemeForNode(node: SubTreeOfKind<MolstarTree, 'color' | 'color_from_uri' | 'color_from_source' | 'representation'> | undefined, context: MolstarLoadingContext): StateTransformer.Params<StructureRepresentation3D>['colorTheme'] {
    if (node?.kind === 'representation') {
        const children = getChildren(node).filter(c => c.kind === 'color' || c.kind === 'color_from_uri' || c.kind === 'color_from_source') as MolstarNode<'color' | 'color_from_uri' | 'color_from_source'>[];
        if (children.length === 0) {
            return {
                name: 'uniform',
                params: { value: decodeColor(DefaultColor) },
            };
        } else if (children.length === 1 && appliesColorToWholeRepr(children[0])) {
            return colorThemeForNode(children[0], context);
        } else {
            const layers: MultilayerColorThemeProps['layers'] = children.map(
                c => ({ theme: colorThemeForNode(c, context), selection: componentPropsFromSelector(c.kind === 'color' ? c.params.selector : undefined) })
            );
            return {
                name: MultilayerColorThemeName,
                params: { layers },
            };
        }
    }
    let annotationId: string | undefined = undefined;
    let fieldName: string | undefined = undefined;
    let color: string | undefined = undefined;
    switch (node?.kind) {
        case 'color_from_uri':
        case 'color_from_source':
            annotationId = context.annotationMap?.get(node);
            fieldName = node.params.field_name ?? Defaults[node.kind].field_name;
            break;
        case 'color':
            color = node.params.color;
            break;
    }
    if (annotationId) {
        return {
            name: AnnotationColorThemeProvider.name,
            params: { annotationId, fieldName, background: NoColor } satisfies Partial<AnnotationColorThemeProps>,
        };
    } else {
        return {
            name: 'uniform',
            params: { value: decodeColor(color) },
        };
    }
}
function appliesColorToWholeRepr(node: MolstarNode<'color' | 'color_from_uri' | 'color_from_source'>): boolean {
    if (node.kind === 'color') {
        return !isDefined(node.params.selector) || node.params.selector === 'all';
    } else {
        return true;
    }
}

export function makeNearestReprMap(root: MolstarTree) {
    const map = new Map<MolstarNode, MolstarNode<'representation'>>();
    // Propagate up:
    dfs(root, undefined, (node, parent) => {
        if (node.kind === 'representation') {
            map.set(node, node);
        }
        if (node.kind !== 'structure' && map.has(node) && parent && !map.has(parent)) { // do not propagate above the lowest structure node
            map.set(parent, map.get(node)!);
        }
    });
    // Propagate down:
    dfs(root, (node, parent) => {
        if (parent && map.has(parent)) {
            map.set(node, map.get(parent)!);
        }
    });
    return map;
}