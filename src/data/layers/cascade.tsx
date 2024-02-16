import { BaseLayer, createLayer } from "game/layers";
import { createResource } from "../../features/resources/resource";
import Decimal, { DecimalSource, format } from "../../util/bignum";
import { createReset } from "../../features/reset";
import { createLayerTreeNode } from "../common";
import { addTooltip } from "../../features/tooltips/tooltip";
import { createResourceTooltip } from "../../features/trees/tree";
import { CoercableComponent, jsx } from "../../features/feature";
import MainDisplay from "../../features/resources/MainDisplay.vue";
import { createRepeatable, GenericRepeatable, RepeatableOptions } from "../../features/repeatable";
import {
    CostRequirement,
    createCostRequirement,
    displayRequirements
} from "../../game/requirements";
import { computed, effect, ref, Ref, unref } from "vue";
import { joinJSX, render, renderRow } from "../../util/vue";
import { noPersist, persistent } from "../../game/persistence";
import {
    bonusAmountDecorator,
    BonusAmountFeatureOptions,
    GenericBonusAmountFeature
} from "../../features/decorators/bonusDecorator";
import {
    createModifierSection,
    createMultiplicativeModifier,
    createSequentialModifier,
    Modifier
} from "../../game/modifiers";
import { WithRequired } from "../../util/common";
import {
    effectDecorator,
    EffectFeatureOptions,
    GenericEffectFeature
} from "../../features/decorators/common";
import { createUpgrade, GenericUpgrade, UpgradeOptions } from "../../features/upgrades/upgrade";
import { ProcessedComputable } from "../../util/computed";
import { chunkArray } from "../../util";
import ChunkedRenderRow from "../../components/custom/ChunkedRenderRow.vue";
import upgrade from "../../features/upgrades/Upgrade.vue";

type LayerBuildData = {
    position: number;
    size: number;
    upgrade: number;
    repeatable: number;
};

type CascadeStructureData = {
    requiredSize: number;
    baseCost: DecimalSource;
    scaling: DecimalSource;
};

type CascadeStructure = GenericRepeatable &
    GenericBonusAmountFeature & {
        bonusAmountRaw: Ref<DecimalSource>;
    };

type CascadeStructureOptions = RepeatableOptions &
    BonusAmountFeatureOptions & {
        bonusAmountRaw: Ref<DecimalSource>;
    };

// appliesTo is an index for a given C, -1 for all boost, and undefined for nothing

type CascadeUpgrade = GenericUpgrade &
    GenericEffectFeature<DecimalSource> & {
        appliesTo: number | undefined;
    };

type CascadeUpgradeOptions = UpgradeOptions &
    EffectFeatureOptions<DecimalSource> & {
        appliesTo: number | undefined;
    };

type CascadeRepeatable = GenericRepeatable &
    GenericEffectFeature<DecimalSource> & {
        appliesTo: number | undefined;
    };

type CascadeRepeatableOptions = RepeatableOptions &
    EffectFeatureOptions<DecimalSource> & {
        appliesTo: number | undefined;
    };

const structureData: CascadeStructureData[] = [
    {
        requiredSize: -2,
        baseCost: 1,
        scaling: 1.4
    },
    {
        requiredSize: -1,
        baseCost: 1e5,
        scaling: 1.5
    },
    {
        requiredSize: 0,
        baseCost: 1e12,
        scaling: 1.6
    }
];

const createCascade = function (data: LayerBuildData) {
    const id = "C";
    const name = "Cascade-" + data.position;
    const color = "#4BDC13";
    const layer = createLayer(id + "-" + data.position, function (this: BaseLayer) {
        const points = createResource<DecimalSource>(1, "stuff");

        const reset = createReset(() => ({
            thingsToReset: (): Record<string, unknown>[] => [layer]
        }));

        const treeNode = createLayerTreeNode(() => ({
            layerID: this.id,
            display: id,
            color,
            reset
        }));
        const tooltip = addTooltip(treeNode, {
            display: createResourceTooltip(points),
            pinnable: true
        });

        function cascadeRequirement(
            data: { baseCost: DecimalSource; scaling: DecimalSource },
            obj: { amount: ProcessedComputable<DecimalSource> }
        ): CostRequirement {
            return createCostRequirement(() => ({
                cost: computed(() => {
                    return Decimal.mul(data.baseCost, Decimal.pow(data.scaling, unref(obj.amount)));
                }),
                resource: noPersist(points)
            }));
        }

        const allBoostModifiers: Modifier[] = [];
        const allBoostModifierRaw = createSequentialModifier(() => allBoostModifiers);
        const allBoostModifier = createMultiplicativeModifier(() => ({
            multiplier: computed(() => allBoostModifierRaw.apply(1)),
            description: "All Boost"
        }));

        const structures: CascadeStructure[] = [];
        const modifiers: Modifier[][] = [];
        for (let i = 0; i < structureData.length; i++) {
            const data = structureData[i];
            structures[i] = createRepeatable<CascadeStructureOptions>(
                obj => ({
                    requirements: cascadeRequirement(data, obj),
                    display: jsx(() => (
                        <>
                            {id + "-" + i}
                            <br />
                            {"Amount: " +
                                format(unref((obj as unknown as CascadeStructure).totalAmount)) +
                                " (" +
                                format(unref(obj.amount)) +
                                ")"}
                            <br />
                            {displayRequirements((obj as unknown as CascadeStructure).requirements)}
                        </>
                    )),
                    bonusAmountRaw: persistent(0),
                    bonusAmount: computed(
                        () => (obj as unknown as CascadeStructure).bonusAmountRaw.value
                    )
                }),
                bonusAmountDecorator
            ) as unknown as CascadeStructure;
            modifiers[i] = [
                createMultiplicativeModifier(() => ({
                    multiplier: structures[i].totalAmount,
                    description: () => "Structure Count"
                })),
                allBoostModifier
            ];
        }

        const upgrades: Record<string, CascadeUpgrade> = {
            res0: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 200,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.pow(1.1, unref(structures[0].amount));
                    },
                    display: {
                        title: "Resonance 0",
                        description: "Purchased C-0 boost themselves by 1.1x",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: 0
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade,
            spec1: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 1e5,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return 2;
                    },
                    display: {
                        title: "Spectrum 1",
                        description: "All production on this layer is doubled",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: -1
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade,
            res1: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 2e7,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.pow(1.08, unref(structures[1].amount));
                    },
                    display: {
                        title: "Resonance 1",
                        description: "Purchased C-1 boost themselves by 1.08x",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: 1
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade,
            cond0: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 1e13,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.add(10, unref(structures[0].totalAmount)).log10();
                    },
                    display: {
                        title: "Condense 0",
                        description: "Boost C-0 by log10 of C-0",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: 0
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade,
            res2: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 2e16,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.pow(1.06, unref(structures[2].amount));
                    },
                    display: {
                        title: "Resonance 2",
                        description: "Purchased C-2 boost themselves by 1.06x",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: 2
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade,
            spec2: createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: 1e21,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return 2;
                    },
                    display: {
                        title: "Spectrum 2",
                        description: "All production on this layer is doubled",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: -1
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade
        };

        const upgradeOrder = Object.values(upgrades);

        const repeatables: CascadeRepeatable[] = [
            createRepeatable<CascadeRepeatableOptions>(
                rep => ({
                    requirements: cascadeRequirement({ baseCost: 100, scaling: 100 }, rep),
                    effect: () => {
                        return Decimal.pow(3, unref(rep.amount));
                    },
                    display: {
                        title: "CR-0",
                        description: "3x C-0 production per level",
                        effectDisplay: jsx(() => (
                            <>{format(unref((rep as unknown as CascadeUpgrade).effect)) + "x"}</>
                        ))
                    },
                    limit: 5,
                    appliesTo: 0
                }),
                effectDecorator
            ) as unknown as CascadeRepeatable,
            createRepeatable<CascadeRepeatableOptions>(
                rep => ({
                    requirements: cascadeRequirement({ baseCost: 1e9, scaling: 1000 }, rep),
                    effect: () => {
                        return Decimal.pow(2, unref(rep.amount));
                    },
                    display: {
                        title: "CR-1",
                        description: "2x C-0 production per level",
                        effectDisplay: jsx(() => (
                            <>{format(unref((rep as unknown as CascadeUpgrade).effect)) + "x"}</>
                        ))
                    },
                    limit: 3,
                    appliesTo: 0
                }),
                effectDecorator
            ) as unknown as CascadeRepeatable,
            createRepeatable<CascadeRepeatableOptions>(
                rep => ({
                    requirements: cascadeRequirement({ baseCost: 1e16, scaling: 1e4 }, rep),
                    effect: () => {
                        return Decimal.pow(2, unref(rep.amount));
                    },
                    display: {
                        title: "CR-2",
                        description: "2x C-1 production per level",
                        effectDisplay: jsx(() => (
                            <>{format(unref((rep as unknown as CascadeUpgrade).effect)) + "x"}</>
                        ))
                    },
                    limit: 3,
                    appliesTo: 1
                }),
                effectDecorator
            ) as unknown as CascadeRepeatable
        ];

        const sequentialModifiers: WithRequired<Modifier, "description">[] = [];
        for (let i = 0; i < modifiers.length; i++) {
            sequentialModifiers[i] = createSequentialModifier(() => modifiers[i]);
        }

        for (const upgrade of upgradeOrder) {
            const applyTo = upgrade.appliesTo;
            if (applyTo === undefined) {
                continue;
            }
            const modifier = createMultiplicativeModifier(() => ({
                multiplier: upgrade.effect,
                description: (upgrade.display as unknown as { title: CoercableComponent }).title,
                enabled: upgrade.bought
            }));
            if (applyTo === -1) {
                allBoostModifiers.push(modifier);
            } else {
                modifiers[applyTo].push(modifier);
            }
        }

        for (const repeatable of repeatables) {
            const applyTo = repeatable.appliesTo;
            if (applyTo === undefined) {
                continue;
            }
            const modifier = createMultiplicativeModifier(() => ({
                multiplier: repeatable.effect,
                description: (repeatable.display as unknown as { title: CoercableComponent }).title,
                enabled: () => Decimal.gt(unref(repeatable.amount), 0)
            }));
            if (applyTo === -1) {
                allBoostModifiers.push(modifier);
            } else {
                modifiers[applyTo].push(modifier);
            }
        }

        this.on("update", diff => {
            points.value = Decimal.add(points.value, sequentialModifiers[0].apply(diff));
            for (let i = 0; i < structures.length - 1; i++) {
                structures[i].bonusAmountRaw.value = Decimal.add(
                    structures[i].bonusAmountRaw.value,
                    sequentialModifiers[i + 1].apply(diff)
                );
            }
        });

        const str = chunkArray(upgradeOrder, 5).map(arr => renderRow(...arr));

        return {
            name,
            color,
            points,
            tooltip,
            //<ChunkedRenderRow components={upgradeOrder} chunkSize={5} />
            display: jsx(() => (
                <>
                    <MainDisplay resource={points} color={color} />
                    {str}
                    <br />
                    {renderRow(...repeatables)}
                    <br />
                    {render(structures[0])}
                    <br />
                    {render(structures[1])}
                    <br />
                    {render(structures[2])}
                    <br />
                    {createModifierSection({
                        title: "All Boost",
                        modifier: allBoostModifierRaw
                    })}
                    <br />
                    {createModifierSection({
                        title: "C-0 Production",
                        modifier: sequentialModifiers[0]
                    })}
                    <br />
                    {createModifierSection({
                        title: "C-1 Production",
                        modifier: sequentialModifiers[1]
                    })}
                    <br />
                    {createModifierSection({
                        title: "C-2 Production",
                        modifier: sequentialModifiers[2]
                    })}
                </>
            )),
            treeNode,
            structures,
            upgrades,
            repeatables
        };
    });
    return layer;
};

export default createCascade;
