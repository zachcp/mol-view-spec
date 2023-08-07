from typing import Any, Literal, Mapping, NotRequired, TypedDict, Union

KindT = Literal[
    "root",
    "download",
    "parse",
    "structure",
    "component",
    "representation",
    "label",
    "label-from-cif",
    "color",
    "color-from-cif",
    "color-from-inline",
    "color-from-json",
    "color-from-url",
    "focus-from-inline",
    "transform",
    "camera",
]


class Node(TypedDict):
    kind: KindT
    params: NotRequired[Mapping[str, Any]]
    children: NotRequired[list["Node"]]


class State(TypedDict):
    version: int
    root: Node


class DownloadParams(TypedDict):
    url: str


ParseFormatT = Literal["mmcif", "bcif", "pdb"]


class ParseParams(TypedDict):
    format: ParseFormatT


class StructureParams(TypedDict):
    kind: Literal["model", "assembly", "symmetry", "crystal-symmetry"]
    assembly_id: NotRequired[str]
    """Use the name to specify which assembly to load"""
    assembly_index: NotRequired[int]
    """0-based assembly index, use this to load the 1st assembly"""
    model_index: NotRequired[int]
    """0-based model index in case multiple NMR frames are present"""
    block_index: NotRequired[int]
    """0-based block index in case multiple mmCIF or SDF data blocks are present"""
    block_header: NotRequired[str]
    """Reference a specific mmCIF or SDF data block by its block header"""
    radius: NotRequired[float]
    """Radius around model coordinates when loading symmetry mates"""
    ijk_min: NotRequired[tuple[int, int, int]]
    """Bottom-left Miller indices"""
    ijk_max: NotRequired[tuple[int, int, int]]
    """Top-right Miller indices"""


ComponentSelectorT = Literal["all", "polymer", "protein", "nucleic", "branched", "ligand", "ion", "water"]


class ComponentParams(TypedDict):
    selector: ComponentSelectorT


RepresentationTypeT = Literal["ball-and-stick", "cartoon", "surface"]
ColorNamesT = Literal["red", "white", "blue"]
ColorT = Union[ColorNamesT, str]  # str represents hex colors for now
# TODO could validate against color names and a regex for hex colors -- or simplify to str


class RepresentationParams(TypedDict):
    type: RepresentationTypeT
    color: NotRequired[ColorT]


SchemaT = Literal[
    "whole-structure",
    "entity",
    "chain",
    "auth-chain",
    "residue",
    "auth-residue",
    "residue-range",
    "auth-residue-range",
    "atom",
    "auth-atom",
]
SchemaFormatT = Literal["cif", "json"]


class InlineSchemaParams(TypedDict):  # TODO split into actual subschemas if we want to keep this around
    label_entity_id: NotRequired[str]
    label_asym_id: NotRequired[str]
    auth_asym_id: NotRequired[str]
    label_seq_id: NotRequired[int]
    auth_seq_id: NotRequired[int]
    pdbx_PDB_ins_code: NotRequired[str]
    beg_label_seq_id: NotRequired[int]
    end_label_seq_id: NotRequired[int]
    """End indices are inclusive"""
    beg_auth_seq_id: NotRequired[int]
    end_auth_seq_id: NotRequired[int]
    """End indices are inclusive"""
    residue_index: NotRequired[int]
    """0-based residue index in the source file"""
    atom_id: NotRequired[int]
    atom_index: NotRequired[int]
    """0-based atom index in the source file"""


class LabelParams(TypedDict):
    schema: SchemaT


class LabelCifCategoryParams(LabelParams):
    category_name: str


class LabelUrlParams(LabelParams):
    url: str
    format: SchemaFormatT


class LabelJsonParams(LabelParams):
    data: str


class LabelInlineParams(LabelParams, InlineSchemaParams):
    text: str


class ColorParams(TypedDict):
    schema: SchemaT


class ColorCifCategoryParams(ColorParams):
    category_name: str


class ColorUrlParams(ColorParams):
    url: str
    format: SchemaFormatT


class ColorJsonParams(ColorParams):
    data: str


class ColorInlineParams(ColorParams, InlineSchemaParams):
    color: ColorT
    tooltip: NotRequired[str]


class FocusParams(TypedDict):  # TODO is this focus-repr or highlight? global vs. per-representation
    schema: SchemaT


class FocusInlineParams(FocusParams, InlineSchemaParams):
    pass


class TransformParams(TypedDict):
    transformation: NotRequired[
        tuple[
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
            float,
        ]
    ]
    """4x4 matrix in a column major (j * 4 + i indexing) format, this is equivalent to Fortran-order in numpy, 
    to be multiplied from the left"""
    rotation: NotRequired[tuple[float, float, float, float, float, float, float, float, float]]
    """In a column major (j * 4 + i indexing) format, this is equivalent to Fortran-order in numpy, to be multiplied 
    from the left"""
    translation: NotRequired[tuple[float, float, float]]


# TODO where does this go? basically global, entirely independent of the actual scene, a bit like "background color"
class CameraParams(TypedDict):
    position: tuple[float, float, float]
    direction: tuple[float, float, float]
    radius: float
