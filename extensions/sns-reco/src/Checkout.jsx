import React, { useEffect, useState } from "react";
import {
  reactExtension,
  Divider,
  Image,
  Banner,
  Heading,
  Button,
  InlineLayout,
  BlockStack,
  Text,
  SkeletonText,
  SkeletonImage,
  useCartLines,
  useApplyCartLinesChange,
  useApi,
  useMetafield,
  useAppMetafields,
  Select,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => <App />);

function App() {
  const { query, i18n } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState({});
  const [showError, setShowError] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [showVariantSelectors, setShowVariantSelectors] = useState({});
  const lines = useCartLines();

  const metafield = useMetafield({
    namespace: "custom",
    key: "recommendation",
  });

  const accessToken = 'cba299c1bc61707d3c32c4029e8862c2';
  const shopDomain = 'checkout-ui-testing-one.myshopify.com';
  const graphQlUrl = `https://${shopDomain}/api/2023-07/graphql.json`;

  const fetchPage = async () => {
    try {
      const headers = new Headers();
      headers.append("X-Shopify-Storefront-Access-Token", accessToken);
      headers.append("Content-Type", "application/json");
      const query = `query page ($handle: String) {
        page(handle: $handle) {
          title
          upsellCollection:metafield(namespace:"custom", key: "recommendation") {
            value
          }
        }
      }`;
      const variables = { handle: 'global-page-cart-data-do-not-delete' };
  
      const graphql = JSON.stringify({
        query,
        variables
      });
      const requestOptions = {
        method: 'POST',
        headers: headers,
        body: graphql
      };
  
      const response = await fetch(graphQlUrl, requestOptions);
      return await response.json();
    } catch (error) {
      console.error("Error fetching page:", error);
      return null;
    }
  };

  (async () => {
    const pageJson = await fetchPage();
    console.log("Fetched Page JSON:", pageJson);
  })();


  useEffect(() => {
    async function fetchProducts() {
      try {
        let collectionId = null;
        
        // First try to get collection ID from the page metafield
        const pageJson = await fetchPage();
        const pageCollectionId = pageJson?.data?.page?.upsellCollection?.value;
        
        if (pageCollectionId?.includes("gid://shopify/Collection/")) {
          collectionId = pageCollectionId.trim();
        }
        // Fallback to the direct metafield if page fetch didn't work
        else if (metafield?.value?.includes("gid://shopify/Collection/")) {
          collectionId = metafield.value.trim();
        }
  
        if (collectionId) {
          const { data } = await query(
            `query ($id: ID!, $first: Int!) {
              collection(id: $id) {
                products(first: $first) {
                  nodes {
                    id
                    title
                    images(first: 1) {
                      nodes {
                        url
                      }
                    }
                    variants(first: 10) {
                      nodes {
                        id
                        title
                        price {
                          amount
                        }
                        availableForSale
                      }
                    }
                  }
                }
              }
            }`,
            {
              variables: {
                id: collectionId,
                first: 5,
              },
            }
          );
  
          if (data?.collection?.products?.nodes) {
            setProducts(data.collection.products.nodes);
            const initialSelected = {};
            data.collection.products.nodes.forEach((product) => {
              const availableVariant = product.variants.nodes.find(v => v.availableForSale);
              if (availableVariant) {
                initialSelected[product.id] = availableVariant.id;
              }
            });
            setSelectedVariants(initialSelected);
            return;
          }
        }
  
        // fallback to general product fetch if no collection found
        const { data } = await query(
          `query ($first: Int!) {
            products(first: $first) {
              nodes {
                id
                title
                images(first: 1) {
                  nodes {
                    url
                  }
                }
                variants(first: 10) {
                  nodes {
                    id
                    title
                    price {
                      amount
                    }
                    availableForSale
                  }
                }
              }
            }
          }`,
          { variables: { first: 5 } }
        );
  
        setProducts(data?.products?.nodes || []);
        const initialSelected = {};
        data?.products?.nodes.forEach((product) => {
          const availableVariant = product.variants.nodes.find(v => v.availableForSale);
          if (availableVariant) {
            initialSelected[product.id] = availableVariant.id;
          }
        });
        setSelectedVariants(initialSelected);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    }
  
    fetchProducts();
  }, [query, metafield]);

  async function handleAddToCart(productId) {
    const variantId = selectedVariants[productId];
    if (!variantId) return;

    setAdding((prev) => ({ ...prev, [productId]: true }));
    const result = await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: variantId,
      quantity: 1,
    });
    setAdding((prev) => ({ ...prev, [productId]: false }));
    if (result.type === "error") {
      setShowError(true);
      console.error(result.message);
    }
  }

  function handleVariantChange(productId, variantId) {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: variantId,
    }));
  }

  function toggleVariantSelector(productId) {
    setShowVariantSelectors((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  }

  if (loading) {
    return (
      <BlockStack spacing="loose">
        <Divider />
        <Heading level={2}>You might also like</Heading>
        <BlockStack spacing="loose">
          {[...Array(3)].map((_, index) => (
            <InlineLayout key={index} spacing="base" columns={[64, "fill", "auto"]} blockAlignment="center">
              <SkeletonImage aspectRatio={1} />
              <BlockStack spacing="none">
                <SkeletonText inlineSize="large" />
                <SkeletonText inlineSize="small" />
              </BlockStack>
              <Button appearance="critical" kind="secondary" disabled>
                Add
              </Button>
            </InlineLayout>
          ))}
        </BlockStack>
      </BlockStack>
    );
  }

  const productsOnOffer = getProductsOnOffer(lines, products, selectedVariants);

  if (!productsOnOffer.length) return null;

  return (
    <BlockStack spacing="loose">
      <Divider />
      <Heading level={2}>You might also like</Heading>
      <BlockStack spacing="loose">
        {productsOnOffer.map((product) => {
          const availableVariants = product.variants.nodes.filter(v => v.availableForSale);
          if (!availableVariants.length) return null;

          const selectedVariantId = selectedVariants[product.id];
          const selectedVariant = availableVariants.find(v => v.id === selectedVariantId) || availableVariants[0];
          const hasMultipleVariants = availableVariants.length > 1;
          const showSelector = showVariantSelectors[product.id];

          return (
            <BlockStack key={product.id} spacing="base">
              <InlineLayout spacing="base" columns={[64, "fill", "auto"]} blockAlignment="center">
                <Image
                  border="base"
                  borderWidth="base"
                  borderRadius="loose"
                  source={product.images.nodes[0]?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"}
                  accessibilityDescription={product.title}
                  aspectRatio={1}
                />
                <BlockStack spacing="none">
                  <Text size="medium" emphasis="bold">
                    {product.title}
                  </Text>
                  <Text appearance="critical">{i18n.formatCurrency(selectedVariant.price.amount)}</Text>
                </BlockStack>

                {hasMultipleVariants ? (
                  showSelector ? (
                    <Button
                      kind="secondary"
                      appearance="critical"
                      loading={adding[product.id]}
                      onPress={() => {
                        handleAddToCart(product.id);
                        toggleVariantSelector(product.id);
                      }}
                    >
                      Add
                    </Button>
                  ) : (
                    <Button
                      kind="secondary"
                      appearance="critical"
                      onPress={() => toggleVariantSelector(product.id)}
                    >
                      Options
                    </Button>
                  )
                ) : (
                  <Button
                    kind="secondary"
                    appearance="critical"
                    loading={adding[product.id]}
                    onPress={() => handleAddToCart(product.id)}
                  >
                    Add
                  </Button>
                )}
              </InlineLayout>

              {hasMultipleVariants && showSelector && (
                <Select
                  value={selectedVariantId}
                  onChange={(value) => handleVariantChange(product.id, value)}
                  options={availableVariants.map((variant) => ({
                    value: variant.id,
                    label: variant.title === "Default Title" ? "Default" : variant.title,
                  }))}
                />
              )}
            </BlockStack>
          );
        })}
      </BlockStack>

      {showError && (
        <Banner status="critical">
          There was an issue adding this product. Please try again.
        </Banner>
      )}
    </BlockStack>
  );
}

function getProductsOnOffer(lines, products, selectedVariants) {
  const cartLineProductVariantIds = lines.map((item) => item.merchandise.id);
  return products.filter((product) =>
    product.variants.nodes.some((variant) => {
      const isSelected = selectedVariants[product.id] === variant.id;
      return variant.availableForSale &&
        !cartLineProductVariantIds.includes(variant.id) &&
        (product.variants.nodes.length === 1 || isSelected);
    })
  );
}
