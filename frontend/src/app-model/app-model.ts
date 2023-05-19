import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui/react18';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';

import { loadMVSTree } from './load-tree';
import { SubTreeOfKind } from './tree/generic';
import { MVSTree } from './tree/mvs';
import { convertMvsToMolstar, treeToString } from './tree/tree-utils';


export class AppModel {
    plugin?: PluginUIContext;

    async initPlugin(target: HTMLDivElement) {
        const defaultSpec = DefaultPluginUISpec();
        this.plugin = await createPluginUI(target, {
            ...defaultSpec,
            layout: {
                initial: {
                    isExpanded: false,
                    showControls: true,  // original: false
                    controlsDisplay: 'landscape',  // original: not given
                },
            },
            components: {
                // controls: { left: 'none', right: 'none', top: 'none', bottom: 'none' },
                controls: { right: 'none', top: 'none', bottom: 'none' },
            },
            canvas3d: {
                camera: {
                    helper: { axes: { name: 'off', params: {} } }
                }
            },
            config: [
                [PluginConfig.Viewport.ShowExpand, true],  // original: false
                [PluginConfig.Viewport.ShowControls, true],  // original: false
                [PluginConfig.Viewport.ShowSelectionMode, false],
                [PluginConfig.Viewport.ShowAnimation, false],
            ],
        });
    }

    public async foo() {
        console.log('foo', this.plugin);
        if (!this.plugin) return;
        this.plugin.behaviors.layout.leftPanelTabName.next('data');

        // const download = await this.plugin.build().toRoot().apply(Download, { isBinary: false, url: 'https://www.ebi.ac.uk/pdbe/entry-files/download/pdb1tqn.ent' }).commit();
        // await this.plugin.build().to(download).apply(TrajectoryFromPDB, {}).commit();

        // const download2 = await this.plugin.build().toRoot().apply(Download, { isBinary: true, url: 'https://www.ebi.ac.uk/pdbe/entry-files/download/1cbs.bcif' }).commit();
        // const cif = await this.plugin.build().to(download2).apply(ParseCif, {}).commit();
        // const traj = await this.plugin.build().to(cif).apply(TrajectoryFromMmCif, {}).commit();
        // const model = await this.plugin.build().to(traj).apply(ModelFromTrajectory, {modelIndex: 0}).commit();
        // const struct = await this.plugin.build().to(model).apply(StructureFromModel, {}).commit();
        // const repr = await this.plugin.build().to(struct).apply(StructureRepresentation3D, {}).commit();

        const exampleUrls = {
            load: 'http://localhost:9000/api/v1/examples/load/1cbs',
            label: 'http://localhost:9000/api/v1/examples/label/1cbs',
            color: 'http://localhost:9000/api/v1/examples/color/1cbs',
        };

        // const data = await getTreeFromUrl(exampleUrls.load);
        const data = TEST_DATA;

        const DELETE_PREVIOUS = true;
        await loadMVSTree(this.plugin, data, DELETE_PREVIOUS);

        for (const url of Object.values(exampleUrls)) {
            const data = await getTreeFromUrl(url);
            console.log('MVS tree:');
            console.log(treeToString(data));

            const converted = convertMvsToMolstar(data);
            console.log('Converted MolStar tree:');
            console.log(treeToString(converted));
        }
    }
}

async function getTreeFromUrl(url: string): Promise<SubTreeOfKind<MVSTree, 'root'>> {
    console.log(url);
    const response = await fetch(url);
    const data = await response.json() as SubTreeOfKind<MVSTree, 'root'>;
    if (data.kind !== 'root') throw new Error('FormatError');
    return data;
}

const TEST_DATA: SubTreeOfKind<MVSTree, 'root'> = {
    "kind": "root",
    "children": [
        {
            "kind": "download", "params": { "url": "https://www.ebi.ac.uk/pdbe/entry-files/download/1tqn.bcif" },
            // "kind": "download", "params": { "url": "https://www.ebi.ac.uk/pdbe/entry-files/download/pdb1tqn.ent" },
            "children": [
                {
                    "kind": "parse", "params": { "format": "mmcif", "is_binary": true },
                    // "kind": "parse", "params": { "format": "pdb", "is_binary": false },
                    "children": [
                        {
                            "kind": "structure", "params": { "model_index": 0, "assembly_id": "1" },
                            "children": [
                                {
                                    "kind": "component", "params": { "selector": "protein" },
                                    "children": [
                                        {
                                            "kind": "representation", "params": { "type": "cartoon", "color": "white" },
                                            "children": [
                                                {
                                                    "kind": "color", "params": { "label_asym_id": "A", "label_seq_id": 64, "color": "red" }
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    "kind": "component", "params": { "selector": "ligand" },
                                    "children": [
                                        {
                                            "kind": "representation", "params": { "type": "ball-and-stick" },
                                            "children": [
                                                {
                                                    "kind": "color-from-cif", "params": { "category_name": "my_custom_cif_category" }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        { "kind": "structure", "params": { "model_index": 0, "assembly_id": "2" } },
                        { "kind": "structure", "params": { "model_index": 1, "assembly_id": "1" } },
                        { "kind": "structure", "params": { "model_index": 1, "assembly_id": "2" } },
                        { "kind": "structure", "params": { "model_index": 1, "assembly_id": "3" } },
                        { "kind": "structure", "params": { "model_index": 2, "assembly_id": "1" } },
                        { "kind": "structure", "params": { "model_index": 2, "assembly_id": "2" } },
                        { "kind": "structure", "params": { "model_index": 2, "assembly_id": "3" } },
                        { "kind": "structure", "params": { "model_index": 2, "assembly_id": undefined } }
                    ]
                }
            ]
        },
        {
            "kind": "raw", "params": { "data": "hello" }, "children": [
                { "kind": "parse", "params": { "format": "pdb", "is_binary": false } },
                { "kind": "parse", "params": { "format": "mmcif", "is_binary": true } },
                { "kind": "parse", "params": { "format": "mmcif", "is_binary": false } }
            ]
        },
        {
            "kind": "raw", "params": { "data": "ciao" }
        }

    ]
};
