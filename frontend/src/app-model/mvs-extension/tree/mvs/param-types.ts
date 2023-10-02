/**
 * Copyright (c) 2023 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Adam Midlik <midlik@gmail.com>
 */

import * as t from 'io-ts';

import { ValueFor, choice, float, int, list, nullable, str, tuple, union } from '../generic/params-schema';


/** `format` parameter values of `parse` node in MVS tree */
export const ParseFormatT = choice('mmcif', 'bcif', 'pdb');
export type ParseFormatT = ValueFor<typeof ParseFormatT>

/** `format` parameter values of `parse` node in Molstar tree */
export const MolstarParseFormatT = choice('cif', 'pdb');
export type MolstarParseFormatT = ValueFor<typeof MolstarParseFormatT>

export const StructureKindT = choice('model', 'assembly', 'symmetry', 'symmetry-mates');

export const ComponentSelectorT = choice('all', 'polymer', 'protein', 'nucleic', 'branched', 'ligand', 'ion', 'water');

export const ComponentExpression = t.partial({
    label_entity_id: str,
    label_asym_id: str,
    auth_asym_id: str,
    label_seq_id: int,
    auth_seq_id: int,
    pdbx_PDB_ins_code: str,
    beg_label_seq_id: int,
    end_label_seq_id: int,
    beg_auth_seq_id: int,
    end_auth_seq_id: int,
    label_atom_id: str,
    auth_atom_id: str,
    type_symbol: str,
    atom_id: int,
    atom_index: int,
});

export const RepresentationTypeT = choice('ball-and-stick', 'cartoon', 'surface');

export const ColorNamesT = choice('white', 'gray', 'black', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'magenta');

export const SchemaT = choice('whole-structure', 'entity', 'chain', 'auth-chain', 'residue', 'auth-residue', 'residue-range', 'auth-residue-range', 'atom', 'auth-atom', 'all-atomic');

export const SchemaFormatT = choice('cif', 'bcif', 'json');

export const Vector3 = tuple([float, float, float]);

export const Matrix = list(float);

/** Hexadecimal color string, e.g. '#FF1100' */
export type HexColorString = string & { '@type': 'HexColorString' }

const hexColorRegex = /^#([0-9A-F]{3}){1,2}$/i; // matches #FF1100 or #f10

export function isHexColorString(str: any): str is HexColorString {
    return typeof str === 'string' && hexColorRegex.test(str);
}

export const HexColorT = new t.Type<HexColorString>(
    'HexColorT',
    ((value: any) => typeof value === 'string') as any,
    (value, ctx) => isHexColorString(value) ? { _tag: 'Right', right: value } : { _tag: 'Left', left: [{ value: value, context: ctx, message: `"${value}" is not a valid hex color string` }] },
    value => value
);

export const ColorT = union([HexColorT, ColorNamesT]);
