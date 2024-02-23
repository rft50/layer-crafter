import { BaseLayer, createLayer } from "game/layers";
import { createResource, Resource } from "../../features/resources/resource";
import Decimal, { DecimalSource, format } from "../../util/bignum";
import { createReset } from "../../features/reset";
import { createCollapsibleModifierSections, createLayerTreeNode } from "../common";
import { addTooltip } from "../../features/tooltips/tooltip";
import { createResourceTooltip } from "../../features/trees/tree";
import { CoercableComponent, jsx } from "../../features/feature";
import MainDisplay from "../../features/resources/MainDisplay.vue";
import { createRepeatable, GenericRepeatable, RepeatableOptions } from "../../features/repeatable";
import {
    CostRequirement,
    createBooleanRequirement,
    createCostRequirement,
    displayRequirements
} from "../../game/requirements";
import { computed, ref, Ref, unref } from "vue";
import { render, renderCol, renderRow } from "../../util/vue";
import { noPersist, Persistent, persistent } from "../../game/persistence";
import {
    bonusAmountDecorator,
    BonusAmountFeatureOptions,
    GenericBonusAmountFeature
} from "../../features/decorators/bonusDecorator";
import {
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
import Modal from "../../components/Modal.vue";
import ChunkedRenderRow from "../../components/custom/ChunkedRenderRow.vue";
import { CraftedLayer, LayerBuildData } from "../util";
import { createCapModifier } from "../capModifier";
import {
    Achievement,
    AchievementOptions,
    createAchievement
} from "../../features/achievements/achievement";
import { Unsubscribe } from "nanoevents";
import Toggle from "../../components/fields/Toggle.vue";
import Row from "../../components/layout/Row.vue";
import { GenericClickable, setupAutoClick } from "../../features/clickables/clickable";

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
    },
    {
        requiredSize: 1,
        baseCost: 1e20,
        scaling: 1.7
    }
];

const createCascade = function (data: LayerBuildData): CraftedLayer {
    const id = "C";
    const name = "Cascade-" + data.position;
    const color = "#4BDC13";
    const layer = createLayer(id + "-" + data.position, function (this: BaseLayer) {
        let points: Resource & Ref<DecimalSource>;
        const cap: Ref<DecimalSource> = ref(1e25);
        if (data.position === 0) {
            points = createResource<DecimalSource>(1, "stuff");
        } else {
            const priorLayer = data.layers[data.position - 1];
            points = createResource(
                computed({
                    get: () => Decimal.div(unref(priorLayer.points), 1e20),
                    set: v => (priorLayer.points.value = Decimal.mul(v, 1e20))
                }),
                "stuff",
                0,
                true
            );
        }

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
        const autoMilestones: Achievement<AchievementOptions>[] = [];
        const autoHooks: Unsubscribe[] = [];
        const modifiers: Modifier[][] = [];
        for (let i = 0; i < structureData.length; i++) {
            if (i > data.size + 2) break;
            const dat = structureData[i];
            structures[i] = createRepeatable<CascadeStructureOptions>(
                obj => ({
                    requirements: cascadeRequirement(dat, obj),
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
            const togglePersist: Persistent<boolean> = persistent(true);
            autoMilestones[i] = createAchievement(() => ({
                requirements: createCostRequirement(() => ({
                    resource: createResource(structures[i].amount, `C-${i} Amount`),
                    cost: 50,
                    requiresPay: false
                })),
                display: {
                    effectDisplay: "Autobuy C-" + i,
                    optionsDisplay: jsx(() => (
                        <>
                            <Toggle
                                modelValue={togglePersist.value}
                                onUpdate:modelValue={v => {
                                    togglePersist.value = v;
                                }}
                            />
                        </>
                    ))
                },
                small: true,
                showPopups: false,
                togglePersist
            })) as unknown as Achievement<AchievementOptions>;
            autoHooks.push(
                setupAutoClick(this, structures[i] as unknown as GenericClickable, () => {
                    return togglePersist.value && autoMilestones[i].earned.value;
                })
            );
        }

        function createResonanceUpgrade(upData: {
            index: number;
            cost: DecimalSource;
            effect: number;
        }) {
            if (data.size < upData.index - 2) return null as unknown as CascadeUpgrade;
            return createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: upData.cost,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return Decimal.pow(upData.effect, unref(structures[upData.index].amount));
                    },
                    display: {
                        title: "Resonance " + upData.index,
                        description:
                            "Purchased C-" +
                            upData.index +
                            " boost themselves by " +
                            upData.effect +
                            "x",
                        effectDisplay: jsx(() => (
                            <>
                                {format(unref((upgrade as unknown as CascadeUpgrade).effect)) + "x"}
                            </>
                        ))
                    },
                    appliesTo: upData.index
                }),
                effectDecorator
            ) as unknown as CascadeUpgrade;
        }
        function createSpectrumUpgrade(upData: {
            index: number;
            cost: DecimalSource;
            requirement: number;
        }) {
            if (data.upgrade < upData.requirement) return null as unknown as CascadeUpgrade;
            return createUpgrade<CascadeUpgradeOptions>(
                upgrade => ({
                    requirements: createCostRequirement(() => ({
                        cost: upData.cost,
                        resource: noPersist(points)
                    })),
                    effect: () => {
                        return 2;
                    },
                    display: {
                        title: "Spectrum " + upData.index,
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
            ) as unknown as CascadeUpgrade;
        }

        const upgrades: Record<string, CascadeUpgrade> = {
            res0: createResonanceUpgrade({
                index: 0,
                cost: 200,
                effect: 1.1
            }),
            spec1: createSpectrumUpgrade({
                index: 1,
                cost: 1e5,
                requirement: -1
            }),
            res1: createResonanceUpgrade({
                index: 1,
                cost: 2e7,
                effect: 1.08
            }),
            cond0:
                data.upgrade >= 0
                    ? (createUpgrade<CascadeUpgradeOptions>(
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
                                          {format(
                                              unref((upgrade as unknown as CascadeUpgrade).effect)
                                          ) + "x"}
                                      </>
                                  ))
                              },
                              appliesTo: 0
                          }),
                          effectDecorator
                      ) as unknown as CascadeUpgrade)
                    : (null as unknown as CascadeUpgrade),
            res2: createResonanceUpgrade({
                index: 2,
                cost: 2e16,
                effect: 1.06
            }),
            spec2: createSpectrumUpgrade({
                index: 2,
                cost: 1e21,
                requirement: 1
            })
        };

        for (const upKey in upgrades) {
            if (upgrades[upKey] === null) delete upgrades[upKey];
        }
        const upgradeOrder = Object.values(upgrades);

        function createBasicRepeatable(repData: {
            index: number;
            cost: DecimalSource;
            scaling: DecimalSource;
            effect: number;
            limit: number;
            appliesTo: number;
        }) {
            if (data.repeatable < repData.index - 2) return null as unknown as CascadeRepeatable;
            if (data.size < repData.appliesTo - 2) return null as unknown as CascadeRepeatable;
            return createRepeatable<CascadeRepeatableOptions>(
                rep => ({
                    requirements: cascadeRequirement(
                        { baseCost: repData.cost, scaling: repData.scaling },
                        rep
                    ),
                    effect: () => {
                        return Decimal.pow(repData.effect, unref(rep.amount));
                    },
                    display: {
                        title: "CR-" + repData.index,
                        description:
                            repData.effect + "x C-" + repData.appliesTo + " production per level",
                        effectDisplay: jsx(() => (
                            <>{format(unref((rep as unknown as CascadeUpgrade).effect)) + "x"}</>
                        ))
                    },
                    limit: repData.limit,
                    appliesTo: repData.appliesTo,
                    shouldAdd: data.repeatable >= repData.index - 2
                }),
                effectDecorator
            ) as unknown as CascadeRepeatable;
        }

        const repeatables: CascadeRepeatable[] = [
            createBasicRepeatable({
                index: 0,
                cost: 100,
                scaling: 100,
                effect: 3,
                limit: 5 + data.repeatable * 2,
                appliesTo: 0
            }),
            createBasicRepeatable({
                index: 1,
                cost: 1e9,
                scaling: 1e3,
                effect: 2,
                limit: 3 + data.repeatable,
                appliesTo: 0
            }),
            createBasicRepeatable({
                index: 2,
                cost: 1e16,
                scaling: 1e4,
                effect: 3,
                limit: 3,
                appliesTo: 1
            }),
            createBasicRepeatable({
                index: 3,
                cost: 1e21,
                scaling: 1e5,
                effect: 3,
                limit: 3,
                appliesTo: 2
            })
        ];

        for (let i = repeatables.length - 1; i >= 0; i--) {
            if (repeatables[i] === null) repeatables.splice(i, 1);
        }

        const sequentialModifiers: WithRequired<
            Modifier,
            "description" | "invert" | "getFormula"
        >[] = [];
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
        modifiers[0].push(
            createCapModifier({
                cap
            })
        );

        this.on("update", diff => {
            if (data.position === 0)
                points.value = Decimal.add(points.value, sequentialModifiers[0].apply(diff));
            else {
                data.layers[data.position - 1].cap.value = Decimal.mul(
                    1e25,
                    Decimal.max(1, sequentialModifiers[0].apply(10))
                );
            }
            for (let i = 0; i < structures.length - 1; i++) {
                structures[i].bonusAmountRaw.value = Decimal.add(
                    structures[i].bonusAmountRaw.value,
                    sequentialModifiers[i + 1].apply(diff)
                );
            }
        });

        const sectionData: {
            title: string;
            modifier: WithRequired<Modifier, "description" | "invert" | "getFormula">;
            base?: number;
        }[] = [
            {
                title: "All Boost",
                modifier: allBoostModifier
            }
        ];

        for (let i = 0; i < structures.length; i++) {
            sectionData.push({
                title: "C-" + i + " Production",
                modifier: sequentialModifiers[i]
            });
        }

        if (data.position !== 0) {
            sectionData[1].base = 10;
        }

        const [modifierSection, modifierSectionCollapsed] = createCollapsibleModifierSections(
            () => sectionData
        );

        const str = chunkArray(upgradeOrder, 5).map(arr => renderRow(...arr));
        const modalRef = ref(false);

        return {
            name,
            color,
            points,
            cap,
            tooltip,
            // <ChunkedRenderRow components={upgradeOrder} chunkSize={5} />
            display: jsx(() => (
                <>
                    <button
                        class="button"
                        style={{
                            display: "inline-block",
                            fontSize: "20px"
                        }}
                        onClick={() => (modalRef.value = true)}
                    >
                        Modifiers
                    </button>
                    <Modal
                        modelValue={modalRef.value}
                        onUpdate:modelValue={(v: boolean) => {
                            modalRef.value = v;
                        }}
                        v-slots={{
                            header: () => <h2>Modifiers</h2>,
                            body: () => render(modifierSection)
                        }}
                    />
                    <MainDisplay resource={points} color={color} />
                    <div>Production capped at {format(cap.value)}</div>
                    {str}
                    <br />
                    {renderRow(...repeatables)}
                    <br />
                    <Row>
                        {renderCol(...structures)}
                        {renderCol(...autoMilestones)}
                    </Row>
                </>
            )),
            treeNode,
            structures,
            upgrades,
            repeatables,
            modifierSection,
            modifierSectionCollapsed,
            autoMilestones,
            autoHooks
        };
    });
    return layer;
};

export default createCascade;
