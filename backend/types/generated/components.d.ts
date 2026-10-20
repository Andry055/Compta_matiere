import type { Schema, Struct } from '@strapi/strapi';

export interface DemandeLigne extends Struct.ComponentSchema {
  collectionName: 'components_demande_lignes';
  info: {
    description: 'Mat\u00E9riel du stock r\u00E9el demand\u00E9, avec sa quantit\u00E9 et son motif.';
    displayName: 'Ligne de demande';
  };
  attributes: {
    designation: Schema.Attribute.String;
    materiel: Schema.Attribute.Relation<'manyToOne', 'api::material.material'>;
    motif: Schema.Attribute.Text;
    quantite: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    quantite_demandee: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'demande.ligne': DemandeLigne;
    }
  }
}
