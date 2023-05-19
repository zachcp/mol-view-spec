from fastapi import APIRouter
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse

from app.config import settings
from molviewspec.builder import Root

router = APIRouter()


@router.get("/load/{id}",
            description="""
Download a minimal example that visualizes a given PDB entry in cartoon representation.
            """)
async def download_example(id: str):
    builder = Root()
    (
        builder.download(url=f"https://www.ebi.ac.uk/pdbe/entry-files/download/{id.lower()}_updated.cif")
        .parse(format="mmcif")
        .structure()
        .component()
        .representation()
    )
    return JSONResponse(builder.node)


@router.get("/label/{id}")
async def label_example(id: str):
    builder = Root()
    (
        builder.download(url=f"https://www.ebi.ac.uk/pdbe/entry-files/download/{id.lower()}_updated.cif")
        .parse(format="mmcif")
        .structure()
        .label(label_asym_id="A", label_seq_id=120, text="Residue 1")
        .label(label_asym_id="C", label_seq_id=271, text="Residue 2")
        .label_from_cif(cif_category_name="my_custom_cif_category")
    )
    return JSONResponse(builder.node)


@router.get("/color/{id}")
async def color_example(id: str):
    builder = Root()
    structure = (
        builder.download(url=f"https://www.ebi.ac.uk/pdbe/entry-files/download/{id.lower()}_updated.cif")
        .parse(format="mmcif")
        .structure()
    )
    structure.component(selector="protein").representation(type="cartoon", color="white").color(
        label_asym_id="A", label_seq_id=64, color="red"
    )
    structure.component(selector="ligand").representation(type="ball-and-stick").color_from_cif(
        cif_category_name="my_custom_cif_category"
    )
    return JSONResponse(builder.node)


@router.get("/data/{id}/molecule")
async def cif_data_molecule(id: str):
    path = settings.TEST_DATA_DIR / id / "molecule.cif"
    return FileResponse(path)


@router.get("/data/{id}/cif-annotations")
async def cif_data_annotation(id: str):
    annotations = (settings.TEST_DATA_DIR / id / "annotations.cif").read_text()
    return PlainTextResponse(f"data_{id}_annotations\n{annotations}")


@router.get("/data/{id}/molecule-and-cif-annotations")
async def cif_data_molecule_and_annotation(id: str):
    mol = (settings.TEST_DATA_DIR / id / "molecule.cif").read_text()
    annotations = (settings.TEST_DATA_DIR / id / "annotations.cif").read_text()
    return PlainTextResponse(f"{mol}\n\n{annotations}")


@router.get("/data/{id}/json-annotations")
async def json_list(id: str):
    """
    Lists all available JSON annotations
    """
    path = settings.TEST_DATA_DIR / id
    names = [f.name[:-5] for f in path.glob("*.json")]
    return JSONResponse(names)


@router.get("/data/{id}/json/{name}")
async def json_data(id: str, name: str):
    path = settings.TEST_DATA_DIR / id / f"{name}.json"
    return FileResponse(path)
